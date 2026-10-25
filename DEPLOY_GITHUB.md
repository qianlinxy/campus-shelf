> v0.9：当前目录75种、新测试研究 `almab-factorial-test-v3`。已完成007的Supabase仅运行008；CloudBase已完成v0.8仅运行03升级；v0.7先02再03；空环境才使用01。登记仍关闭。详见 [v0.9说明](CONVENIENCE_STORE_V09.md)。以下旧版本步骤不得跳过新版增量升级。

> v0.8 当前使用腾讯云 CloudBase。请按 [CloudBase 专用指南](CLOUDBASE_GITHUB_GUIDE.md) 操作。下文保留 Supabase 部署路径；不要在 CloudBase 中直接执行 Supabase 迁移。当前仓库为 qianlinxy/campus-shelf。

v0.8校园适配：当前测试研究为 `almab-factorial-test-v2`。Supabase已有006的项目仅加007；CloudBase空环境用最新01安装，已安装v0.7的环境仅运行 `cloudbase/02_campus_catalog_upgrade.sql`。旧研究/参与者不得自动迁组。详见 [CAMPUS_ADAPTATION_V08.md](CAMPUS_ADAPTATION_V08.md)。
# GitHub Pages + Supabase 部署指南（v0.6）

本目录是可独立发布的仓库根目录。学生打开公开 GitHub Pages 网址即可访问，无需 ChatGPT 或 GitHub 账号。当前未创建 Supabase 项目，也未替你新建 GitHub 远程仓库或修改旧 Sites 网址。

新接入建议先读 [SUPABASE_START_HERE.md](SUPABASE_START_HERE.md)，包含账号/项目申请、2026邮件模板限制、管理员授权和新研究的开放步骤。

## 1. 先发布可浏览的预览版

1. 在自己的 GitHub 账号创建仓库，默认分支用 `main`。
2. 上传本目录中的 `dist/`、`supabase/`、`tests/`、`tools/`、`.github/`、`package.json`、`package-lock.json` 与说明文件。注意隐藏的 `.github` 文件夹也必须上传。不要上传 `.git/`、`.publication/`、`node_modules/` 或历史 Sites 的 `.openai/` 配置。
3. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. 推送到 `main`，或手动运行 **Publish Campus Shelf to GitHub Pages**。流程执行检查、测试、生成配置、上传及发布 `dist`。
5. 默认没有注册服务配置时，站点保持预览模式。购物可体验，验证码发送和资料提交关闭。单文件 `standalone.html` 始终是离线预览。

工作流假定这里就是仓库根目录；如果把整个 `virtual shelf` 作为仓库，需相应修改工作目录与发布路径。

## 2. 创建并配置 Supabase

1. 创建自己的 Supabase 项目，选择符合项目数据管理安排的区域。
2. 在 SQL Editor 依次执行 `supabase/migrations/001_enrollment.sql`、`002_synthetic_catalog.sql`、`003_anthropometry_and_questionnaire.sql` 、`004_physical_shelf_upf_markup.sql` 、`005_fifty_product_catalog.sql` 、`006_factorial_study.sql` 和 `007_campus_catalog_and_zones.sql`。它们按顺序用于新项目，不能直接重复运行。若已经执行旧版001和002，顺序执行003至007增量升级；已有项目只执行尚未执行的文件；无需重建或清空数据。
3. 表和函数建立后，登记默认关闭。`participant_profiles` 只允许登录者读取自己的记录；写入走服务端校验函数。购物表位于不对前端开放的 `private` schema。
4. 从项目 Connect / API 设置复制 **Project URL** 与 **publishable key**。兼容旧版 `anon` key。网页中的公开 key 不是管理员权限，数据保护依赖数据库权限和 RLS。**不要把 `service_role`、`sb_secret_`、数据库密码、SMTP 或短信密钥放入网页、仓库变量或对话。**
5. Auth 的 Site URL 填写最终公开站点根网址，例如 `https://你的账号.github.io/仓库名/`。登记采用输入验证码方式，不需要 ChatGPT OAuth。

### 邮箱验证码

启用 Email provider。先配置自有SMTP；2026年新建免费项目使用默认发信服务时不能自定义模板（[官方变更](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)）。随后修改 **Magic Link** 邮件模板，显示六位验证码，而不是只提供链接，例如：

```html
<h2>Campus Shelf verification code</h2>
<p>Your code is: {{ .Token }}</p>
<p>If you did not request this code, ignore this email.</p>
```

检查新账号确认邮件模板也能提供 `{{ .Token }}`。将 OTP 长度设为6，并确认有效期；页面仅接受6位数字。实际面向学生发送时配置自己的 SMTP，Supabase 的默认邮件服务存在收件人和发送限制。邮箱或手机号首次验证码验证会创建账号，再次使用同一联系方式则登录。

### 巴基斯坦手机号验证码

启用 Phone provider，并在 Supabase 控制台配置其支持的短信供应商和向巴基斯坦 `+92` 号码发送短信的权限、余额与发送设置。供应商密钥只放在控制台。用研究团队自己的测试号码确认送达后，再将下节 `PHONE_AUTH_ENABLED` 设为 `true`。

页面支持 `03001234567`、`+923001234567`、`00923001234567` 和乌都语数字，统一转为 `+923001234567`。默认不开放短信，避免显示一个实际无法发送的入口。邮箱与手机号不是自动合并的两个入口：参与者后续应持续使用同一种方式。

## 3. 填写 GitHub 仓库变量

Settings → Secrets and variables → Actions → **Variables**，添加：

| 变量 | 内容 |
|---|---|
| `SUPABASE_URL` | 项目 HTTPS 根地址 |
| `SUPABASE_PUBLISHABLE_KEY` | publishable key，或旧版 anon key |
| `PUBLIC_SITE_URL` | 最终公开参与入口，包含仓库路径和末尾 `/` |
| `STUDY_ID` | 新研究编号；技术测试用 `almab-factorial-test-v2`，空值保留历史固定条件试用 |
| `ENROLLMENT_ENABLED` | 准备好真实登记后填 `true`；默认 `false` |
| `PHONE_AUTH_ENABLED` | 短信送达测试通过后填 `true`；否则 `false` |
| `CONSENT_VERSION` | 实际采用的参与说明版本，如 `pilot-v2` |
| `INFORMATION_URL_ZH` | 最终中文参与说明与隐私信息 HTTPS 地址 |
| `INFORMATION_URL_EN` | 对应英文说明地址 |
| `INFORMATION_URL_UR` | 对应乌都语说明地址 |

三语说明需包含实际研究团队及联系渠道、参与过程、数据用途、保留期限和退出／更正处理方式。仓库没有假定这些已获批准，也没有填入虚构审批编号。本版登记范围沿用课题的18—26岁；若方案改变，需同时调整前端验证、数据库函数及测试。

要先保持预览，可只填写 `PUBLIC_SITE_URL`，其他留空。即使前端被手动改写，数据库仍按服务端权限校验。

在 Supabase SQL Editor 按实际说明版本开放试用：

```sql
update private.pilot_settings
set consent_version = 'pilot-v2', enrollment_open = true
where id = true;
```

`consent_version` 必须与仓库变量一致。需要暂停新登记和新购物提交时将 `enrollment_open` 改回 `false`。已成功提交的相同购物任务重试仍返回原回执，不会重复新增。

重新运行 Pages 工作流即可应用配置。构建脚本拒绝管理员密钥；选择启用登记但缺少必填配置时会失败，不会静默发布一个伪注册页面。

## 4. 扫码与实际使用

在公开站点点“扫码参与”，二维码由浏览器内置开源库生成，不调用第三方二维码服务。二维码只包含 `PUBLIC_SITE_URL`；扫码打开后，学生仍需验证邮箱或手机号、提交出生日期／性别／学校及身高／体重／腰围（问卷编号可留空）并同意参与说明。**扫码本身不会自动验证身份。** 可下载 SVG 后打印或用于招募材料。不要把登录令牌或个人资料放进参与入口 URL。

## 5. 数据与边界

- 不收集姓名。完整出生日期保存在有权限限制的资料表，前端按巴基斯坦日期计算当前年龄，服务端记录登记当日年龄。
- 联系方式在 Supabase Auth；资料表通过 `user_id` 关联认证账号，使用另一个随机 `participant_id` 关联购物表。身高、体重、腰围与选填的 `questionnaire_code` 放在本人资料表中，不放入购物任务。这是去标识化关联，不是完全匿名。
- 认证令牌仅在当前标签页的 `sessionStorage` 保存；资料字段不进入 `localStorage`、购物日志或本地 JSON 导出。新研究的购物篮经服务器保存后可以恢复；未保存的最后更改仍可能丢失。历史固定条件试用仍只有内存购物篮。
- 结账只发送商品 ID、数量、语言、目录版本和任务 UUID。服务端核算预算、价格和能量，不信任客户端价格。成功后显示“已提交”；失败保留购物篮供重试。已提交任务不可覆盖。
- STUDY_ID为空时保留历史固定条件试用。006新增服务器八组分配、跨登录组别和任务锁定、已保存购物篮恢复、不可覆盖的完成记录。正式研究的食品/标签/对照布局、抽样与分析方案尚待审核冻结；不提供干预盲法。
- 商品价格、营养及 NOVA 是合成数据；包含真实品牌名称也不代表其真实营养表。正式研究需替换为审核目录并同时更新前后端版本。乌都语文本需由当地人员认知测试。
- 新增 `admin.html` 管理看板，服务器管理员名单控制访问，`can_export`控制批量导出；按条件、状态、学校与UTC分配日期筛选，提供分析/商品/日志/目录CSV、字段字典和版本说明。普通学生不能访问全体记录。信息更正、退出和删除请求由研究团队按已公布流程处理。

## 验证记录与官方参考

本地 `npm ci --ignore-scripts`、`npm run check`、`npm test`、`npm run build`。PGlite 开发依赖用于在真实 PostgreSQL 引擎中验证迁移和权限，不进入网页运行环境。

本地自动测试不等于真实 Supabase/邮件/短信送达联调。创建服务后需用团队测试账号验证邮箱首次注册与再次登录、+92短信、资料只读自己的记录、购物提交失败重试和退出。

- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Supabase 邮箱验证码](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase 自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase 手机号登录](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase 行级安全](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth REST API 规范](https://github.com/supabase/auth/blob/master/openapi.yaml)

## v0.2.1 身体测量与前期问卷关联

三项必填：`height_cm`（cm）、`weight_kg`（kg）、`waist_cm`（cm），最多一位小数。`anthropometry_entered_at` 记录服务器收到录入的时间，不代表实际测量日期。请在实际参与说明中加入身体测量收集和跨阶段关联用途，使用更新后的 `CONSENT_VERSION` 并同步服务器版本。

`questionnaire_code` 选填，无编号可留空。编号去除首尾空格、保留大小写，最长80字符；非空值不可重复。当前尚无已核实的前期问卷编号库，填写只表示 `pending_review`，不表示匹配成功。统一编号确定后，研究团队在受保护的数据环境中建立前期问卷记录与 `participant_id` 的对照表；已登记资料的编号补录或更正由有权限的研究人员处理。本版不开放学生反复改写关联编号。不要以身高、体重、腰围或相似出生信息直接自动合并两个人的资料。

003升级保留已有参与者编号、基础资料、条件和购物任务。旧资料新增测量字段为空，重新登录会提示补填，并按更新后的参与说明确认；补填前不能提交新任务。原基础资料若需更正，请由研究团队核查处理。旧四参数注册API对学生关闭，需同时发布本版前端。

完整增补检查见 [QA_V021.md](QA_V021.md)。

## v0.3 四层货架与UPF价格

004迁移为未来登记设置新协议：四层金属货架、替代品视线层、原价、五项标签、候选加价幅度25%。仅对NOVA4涨价20%、25%或30%，其他食品不变。分类、受欢迎参考陈列和逆向层位均可在预览面板切换。详见 [SHELF_DESIGN_V03.md](SHELF_DESIGN_V03.md)。

未来试用条件在 `private.pilot_settings.config` 中设置；例如开启加价用 `config = config || '{"price":true,"markupPercent":25}'::jsonb`。布局 `layoutMode` 可为 `alternatives-eye`、`targets-eye`、`category`、`popularity`；其中 `position` 只在 `alternatives-eye` 时为true。`placementRule` 取 `upf-or-high` 或 `upf`。该历史固定条件试用无正式随机分配；前端隐藏研究者预览控件。既有参与者配置不会被004覆盖，不要将旧任务当作新协议样本。

历史生成器 `tools/seed-catalog.cjs` 已锁定，防止误写002。部署时使用已提供的迁移文件，不能覆盖重跑历史迁移。

## v0.4：50种食品与宽货架

005将目录主键扩展为 `(id,version)`，保留24条v2数据，再加入50条v3数据。未来登记使用v3。原参与者的目录、任务配置和历史回执不变；旧队列应使用原v0.3页面。本版遇到旧目录登记会显示说明，不自动换组。

前端与数据库必须同时升级；仅更新前端但不执行005会产生目录版本不匹配。登记仍默认关闭；已经开放登记的项目不会被005自动关闭，请在部署安排中处理升级窗口。详见 [SHELF_DESIGN_V04.md](SHELF_DESIGN_V04.md) 和 [QA_V04.md](QA_V04.md)。

## v0.6 服务器析因研究

本指南第3节的旧开放SQL只开放资料登记。新研究须同步设置 `private.studies` 的参与说明版本、新分配与任务保存开关；具体执行 [接入步骤](SUPABASE_START_HERE.md)。006默认关闭，管理员名单为空；旧任务不迁入随机队列。为管理员授权后使用 `admin.html`，不得把管理员密钥放在浏览器。
