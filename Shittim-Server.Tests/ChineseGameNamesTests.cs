using Shittim_Server.Services;
using Xunit;

namespace Shittim_Server.Tests;

public sealed class ChineseGameNamesTests
{
    [Fact]
    public void Known_ids_use_the_simplified_chinese_catalog()
    {
        Assert.Equal("爱露", ChineseGameNames.Student(10000, "アル"));
        Assert.Equal("拱心石碎片", ChineseGameNames.Item(1, "キーストーンの欠片"));
        Assert.Equal("信用积分", ChineseGameNames.Currency(1, "クレジットポイント"));
    }

    [Fact]
    public void Unknown_ids_keep_a_readable_fallback()
    {
        Assert.Equal("测试名称", ChineseGameNames.Student(long.MaxValue, "测试名称"));
        Assert.Equal("", ChineseGameNames.Item(long.MaxValue, null));
    }

    [Fact]
    public void Boss_suffixes_are_localized()
    {
        var name = ChineseGameNames.Boss("EN0008_Outdoor_ElasticArmor");
        Assert.Equal("赛特的愤怒（野外・弹力装甲）", name);
    }
}
