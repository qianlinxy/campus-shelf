# Current catalogue: v5 · 75 convenience-store choices

See [CONVENIENCE_STORE_V09.md](CONVENIENCE_STORE_V09.md) for the current inventory and limits. Earlier notes below are historical.

# 巴基斯坦食品目录 v4 · 50种

本次校园适配见 [CAMPUS_ADAPTATION_V08.md](CAMPUS_ADAPTATION_V08.md)。以下v3内容为来源历史；当前v4增加固定展示区和购买单位，替换独立奶酪与芒果条目，太妃糖改为单颗，葡萄干用Kishmish显示。007增量迁移保留所有历史目录和记录。

包含50种食品示例，中文、英文、乌都语独立名称，支持三语搜索。新增或适配了 Rio、Sooper、Cocomo、Slanty、Nimko、烤鹰嘴豆、Samosa、Bun kebab、Dahi、Lassi、水果 Chaat、Chilli Milli 和 rusk，并保留饮用水、鲜果等替代品。

这些是用于文化情境适配的候选目录，不是已完成的校园可得性调查，也未证明在目标大学的销售频率。品牌名称用于识别场景；插画为自行绘制的示意包装。

**所有价格、规格、营养及 NOVA 字段均为合成测试数据，不能作为真实品牌数据使用。** 混合食品或配方不清的 Nimko、Samosa、Bun kebab 和 rusk 暂设 NOVA 未知／灰灯；其他字段也仍需实物成分表审核。不要仅凭“传统食品”或食品名称推断 NOVA。

品牌示例核对来源（只支持名称和产品类型，不支持演示营养值、价格或校园销量）：

- [EBM Sooper 产品页](https://www.ebm.com.pk/products/sooper)
- [EBM Rio 产品页](https://www.ebm.com.pk/products/rio)
- [Ismail Industries 2024 年报](https://ismailindustries.com.pk/wp-content/uploads/2024/09/Annual-Report-2024.pdf)（Bisconni / Candyland 产品示例）

正式目录应记录调查校园、采集日期、店铺／来源、准确 SKU、包装规格、PKR 价格、每100g/ml与每份营养值、配料照片、NOVA 评审与分歧、三语审校。当前 `reference` 仅是产品名称参考，不表示该条已完成核实。

001至005已提供完整建库与升级顺序；历史生成器已锁定，避免50种目录覆盖002。已执行的历史迁移不可覆盖重跑；现有数据库变更必须新建增量迁移。已有参与者与已提交任务的目录不可原地变更；正式迭代应新建版本化目录及相应迁移。

二维码库：`dist/vendor/qrcode.js`，来自 [Kazuhiko Arase 的 qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 官方仓库 `js/dist/qrcode.js`，取用日期2026-10-24；本地保留 MIT 许可证 `QR-LICENSE.txt`。运行时无需 CDN 或外部图片服务。

本次新增固定 `catalogOrder` 与 `popularityRank` 元数据。排名版本synthetic-ranking-v1，仅用于演示受欢迎陈列，未测量校园销量。004增量迁移同步元数据，不改旧价格／营养／NOVA。当前新协议只对NOVA4加价，不把高脂／高糖／高盐非UPF一并加价。商品包装为示意绘图，尚未替换为真实商品照片。

扩展目录新增26种食品，见 [SHELF_DESIGN_V04.md](SHELF_DESIGN_V04.md)。现目录版本 `synthetic-pakistan-catalog-v3`；演示排名 `synthetic-ranking-v2`（新增商品接续演示序号，不代表真实喜好）。005保留v2的24条历史记录，并另存v3的50条记录。所有条目的 `classificationStatus` 均标为未经审核的合成分类。
