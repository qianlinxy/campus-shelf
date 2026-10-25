> v0.10：冷藏冷冻一体柜，新布局v5、新测试研究 `almab-factorial-test-v4`。已有v0.9的Supabase仅运行009，CloudBase仅运行04；登记仍关闭。见 [最新说明](COMBINED_COLD_CABINET_V010.md)。

> v0.9：当前目录75种、新测试研究 `almab-factorial-test-v3`。已完成007的Supabase仅运行008；CloudBase已完成v0.8仅运行03升级；v0.7先02再03；空环境才使用01。登记仍关闭。详见 [v0.9说明](CONVENIENCE_STORE_V09.md)。以下旧版本步骤不得跳过新版增量升级。

# GitHub Pages + 腾讯云 CloudBase（v0.8）

v0.8校园适配：当前测试研究为 `almab-factorial-test-v2`。Supabase已有006的项目仅加007；CloudBase空环境用最新01安装，已安装v0.7的环境仅运行 `cloudbase/02_campus_catalog_upgrade.sql`。旧研究/参与者不得自动迁组。详见 [CAMPUS_ADAPTATION_V08.md](CAMPUS_ADAPTATION_V08.md)。
更新：2026-10-24。已适配源代码；尚未完成真实 CloudBase 邮件与数据库联调，登记保持关闭。

## 1. 当前项目

| 配置 | 值 |
|---|---|
| GitHub 仓库 | https://github.com/qianlinxy/campus-shelf |
| 学生网址（Pages 部署完成后） | https://qianlinxy.github.io/campus-shelf/ |
| 管理员网址 | https://qianlinxy.github.io/campus-shelf/admin.html |
| CloudBase 环境 ID | monetary-dinosaur-d0d39pf87e5f20 |
| 地域 / 数据库 | ap-shanghai / PostgreSQL 模式 |
| 测试研究 ID | almab-factorial-test-v2 |

网页托管在 GitHub Pages；联系方式由 CloudBase 认证服务处理；资料、固定分组、购物篮与提交结果在 CloudBase PostgreSQL 集中保存。前端没有管理员密钥或数据库连接密码。

## 2. 在哪里开启邮箱验证码

打开 [CloudBase 控制台](https://tcb.cloud.tencent.com/)，进入上表环境：

1. 左侧 **身份认证**，然后 **登录方式**。
2. 找到 **邮箱验证码**（部分界面称“邮箱登录”），点击 **配置发件邮箱 / 配置发件人**。
3. 优先按实际控制台提供的 **开启邮件代发** 配置，保存并确认登录方式已开启。
4. 若只提供自定义 SMTP，在控制台填入发件服务配置；授权码和密码不要放到网页或发给开发人员。
5. 用团队邮箱真实测试验证码收件、首次注册和再次登录，再用巴基斯坦学生常用邮箱验证送达。

[官方邮箱配置说明](https://docs.cloudbase.net/authentication-v2/method/email-login)。

前端 Publishable Key 若需查看，在 **环境配置 → API Key** 中找 **Publishable Key / publish_key**。普通 **API Key / service_role** 是管理员凭证，不能放入前端。本次采用的“邮箱验证码 → 用户 Access Token → 数据库 RPC”路径不要求填写匿名公开 key；留空即可先配置邮箱。若填写公开 key，构建程序会校验 anon 角色与环境 ID。

## 3. 确认数据库结构并安装

在该环境的 PostgreSQL 数据库中打开 SQL 编辑器，以环境所有者权限操作。

先执行仓库中的 [cloudbase/00_preflight.sql](cloudbase/00_preflight.sql)。它只返回函数和字段名称/类型，不读取账号资料。确认：

- `auth.users.id` 是 varchar/text，`auth.uid()` 返回 text，存在 `auth.jwt()`、anon/authenticated 角色。
- 核对服务器维护的联系方式验证字段。安装脚本支持顶层 `email_verified` / `email_confirmed_at` 以及 `phone_number_verified` / `phone_verified` / `phone_confirmed_at`；至少存在一个受支持字段。未知结构须先适配，不能删掉验证检查。
- `public.participant_profiles` 不存在；若已有研究表，停止首次安装，先审查升级和保留方案。

核对通过后，执行 [cloudbase/01_install.sql](cloudbase/01_install.sql)。整个首次安装在一个事务中，失败回滚；重复安装会停止。它建立资料表、私有研究表、8组分配、任务、日志、管理员与导出函数，并保留登记/任务关闭状态。**不要直接运行 supabase/migrations 中的旧脚本。**

`01_install.sql` 来自 `node tools/build-cloudbase.cjs`：仅将认证账号字段改为 varchar(64)，研究参与者、任务、事件编号仍使用 UUID，并替换验证字段访问。历史 Supabase 文件保持原样。

若返回 `verified_contact_schema_review_required`，把 **00_preflight 的字段名和类型**交给开发人员核对即可，不要提供任何真实用户行或密码。即使字段名符合，仍要通过实际账号确认验证状态的含义。

[CloudBase PG 身份与权限](https://docs.cloudbase.net/authentication-v2/auth/auth-pg)、[PG REST 连接](https://docs.cloudbase.net/database/postgresql/connecting-to-postgresql)。

## 4. GitHub Pages 发布

仓库已含 `.github/workflows/pages.yml`。在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。提交到 main 后或手动运行 Publish Campus Shelf 工作流，等待 deploy 成功。

工作流默认使用上表的 CloudBase 环境、测试研究 ID 和学生网址。初次发布无需密钥，会发布登记关闭的预览。

需要修改配置时，在 **Settings → Secrets and variables → Actions → Variables** 新建 repository variable：

| 变量 | 值 |
|---|---|
| BACKEND_PROVIDER | cloudbase |
| CLOUDBASE_ENV_ID | monetary-dinosaur-d0d39pf87e5f20 |
| CLOUDBASE_REGION | ap-shanghai |
| CLOUDBASE_PUBLISHABLE_KEY | 可留空；只允许该环境匿名 publish_key |
| PUBLIC_SITE_URL | https://qianlinxy.github.io/campus-shelf/ |
| STUDY_ID | almab-factorial-test-v2（仅合成技术测试） |
| ENROLLMENT_ENABLED | false；完成下节后才能 true |
| PHONE_AUTH_ENABLED | false |
| CONSENT_VERSION | 实际采用的参与说明版本，须与数据库一致 |
| INFORMATION_URL_ZH / EN / UR | 各语言真实参与/隐私说明的 HTTPS 地址 |

修改 Variables 后需重新运行工作流；浏览器读到的 config.js 是发布时生成的。不要把管理员密钥放进 Variables 或源码。Supabase 路径仍可用，需显式选择 `BACKEND_PROVIDER=supabase` 并填写对应 Supabase 公开配置。

## 5. 安全来源和真实联调

在 CloudBase 身份认证的开发设置 / 安全来源设置中，添加 **qianlinxy.github.io**（主机名，不含 https:// 和 /campus-shelf/）。如还需本地联调，按控制台格式登记实际本地来源。自定义域名使用实际主机名。安全来源不替代服务器用户与管理员权限。

当前测试目录全部为合成数据。完成技术检查并采用实际参与说明后，测试环境所有者可以设置（请先替换版本）：

```sql
begin;
update private.pilot_settings
set enrollment_open=true,consent_version='REPLACE_WITH_ACTUAL_VERSION'
where id=true;
update private.studies
set enrollment_open=true,tasks_open=true,consent_version='REPLACE_WITH_ACTUAL_VERSION'
where id='almab-factorial-test-v2';
commit;
```

同一版本填入 CONSENT_VERSION，三个实际说明网址填入 INFORMATION_URL_*，ENROLLMENT_ENABLED 改 true 后重新部署。开启前确认脚本中没有保留占位符；不要使用合成目录开展正式招募。已开始分配后研究定义冻结；正式目录与方案应创建新的研究 ID。

管理员账号须先由团队在 CloudBase 认证系统建立并验证邮箱，再在 SQL 编辑器按该账号的 **字符串 ID** 授权：

```sql
insert into private.study_admins(user_id,can_export)
values('REPLACE_WITH_CLOUDBASE_USER_ID',true);
```

这只是操作示例，不会自动授权任何人。false 表示仅看板查看；true 另允许批量导出。普通参与者无管理权限。管理页允许已有管理员在学生登记关闭期间登录。

真实验收：团队测试邮箱注册/再次登录、资料保存、分组后刷新/跨设备恢复、同一账号重复操作、断线重试、管理员看板/导出、普通账号拒绝管理权限，以及巴基斯坦实际网络。不要用真实学生资料做技术演示。

+92 短信默认关闭。当前官方验证码 HTTP 文档仅明确列出 +86 格式，不能据上海环境推断支持巴基斯坦短信；确认国际短信通道和实际送达后再适配启用。[验证码接口](https://docs.cloudbase.net/http-api/auth/auth-send-verification)。

若后端返回 captcha_required，页面会停止并提示。当前尚无图形挑战组件，正式部署前需按实际触发场景补齐，不能通过关闭防护绕过。

## 6. 管理员如何收集与导出

管理员打开 admin.html，经 CloudBase 邮箱验证码登录，服务器再核对 private.study_admins。每位学生有固定 participant_id、study_id、condition_code（P/O/L）、实际参数版本和唯一任务。16人区组内各8组各2人，刷新不会重新分组。

看板显示8组分配和完成数，支持条件、学校、状态、分配日期筛选。导出分析主表、商品明细、受限操作日志、食品目录、字典和说明。分析主表包含未完成者，结局留空；已完成空篮记录为零。完整出生日期和联系方式不进入分析导出，身高/体重/腰围与前期问卷编号通过参与者编号关联，问卷匹配状态仍待人工审核。

本地验证见 [QA_V07.md](QA_V07.md)；105项本地测试通过不代表真实云端或邮件已经验收。
