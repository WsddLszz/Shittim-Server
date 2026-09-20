using System.Globalization;
using System.Text.Json;
using Microsoft.VisualBasic;

namespace Shittim_Server.Services;

/// <summary>
/// Simplified-Chinese display names used by the Control Center management API.
/// Known IDs come from an offline snapshot so the UI remains fully usable without internet;
/// content newer than the snapshot falls back to the Traditional-Chinese name shipped in ExcelDB.
/// </summary>
internal static class ChineseGameNames
{
    private sealed class Catalog
    {
        public Dictionary<string, string> Students { get; set; } = new();
        public Dictionary<string, string> Items { get; set; } = new();
        public Dictionary<string, string> Equipment { get; set; } = new();
        public Dictionary<string, string> Currencies { get; set; } = new();
        public Dictionary<string, string> Events { get; set; } = new();
        public Dictionary<string, string> Bosses { get; set; } = new();
    }

    private static readonly Lazy<Catalog> Data = new(Load);

    private static Catalog Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Data", "Localization", "zh-CN.json");
        try
        {
            if (!File.Exists(path)) return new Catalog();
            return JsonSerializer.Deserialize<Catalog>(File.ReadAllText(path), new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            }) ?? new Catalog();
        }
        catch
        {
            // The management surface must still start if an optional translation file is missing or malformed.
            return new Catalog();
        }
    }

    internal static string Student(long id, string? fallback) => Find(Data.Value.Students, id, fallback);
    internal static string Item(long id, string? fallback) => Find(Data.Value.Items, id, fallback);
    internal static string Equipment(long id, string? fallback) => Find(Data.Value.Equipment, id, fallback);
    internal static string Currency(long id, string? fallback) => Find(Data.Value.Currencies, id, fallback);
    internal static string Event(long id, string? fallback) => Find(Data.Value.Events, id, fallback);

    internal static string Boss(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        return string.Join(" / ", raw.Split(new[] { ',', '/' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(LocalizeBossPart));
    }

    private static string LocalizeBossPart(string raw)
    {
        var parts = raw.Split('_', StringSplitOptions.RemoveEmptyEntries);
        var key = parts.FirstOrDefault() ?? raw;
        var name = Data.Value.Bosses.GetValueOrDefault(key) ?? key switch
        {
            "EN0008" => "赛特的愤怒",
            _ => Simplify(raw),
        };
        if (parts.Length <= 1 || name == raw) return name;

        var suffixes = parts.Skip(1).Select(p => p switch
        {
            "Street" => "街区",
            "Outdoor" => "野外",
            "Indoor" => "室内",
            "LightArmor" => "轻装甲",
            "HeavyArmor" => "重装甲",
            "Unarmed" => "特殊装甲",
            "ElasticArmor" => "弹力装甲",
            _ => p,
        });
        return $"{name}（{string.Join("・", suffixes)}）";
    }

    internal static string Simplify(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        if (!OperatingSystem.IsWindows()) return value;
        try
        {
            // Control Center is Windows-only; an explicit zh-CN LCID avoids depending on the user's UI language.
            return Strings.StrConv(value, VbStrConv.SimplifiedChinese, 2052) ?? value;
        }
        catch
        {
            return value;
        }
    }

    private static string Find(Dictionary<string, string> map, long id, string? fallback)
    {
        var key = id.ToString(CultureInfo.InvariantCulture);
        if (map.TryGetValue(key, out var known) && !string.IsNullOrWhiteSpace(known)) return known;
        return Simplify(fallback);
    }
}
