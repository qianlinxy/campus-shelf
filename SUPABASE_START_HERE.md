> v0.9：当前目录75种、新测试研究 `almab-factorial-test-v3`。已完成007的Supabase仅运行008；CloudBase已完成v0.8仅运行03升级；v0.7先02再03；空环境才使用01。登记仍关闭。详见 [v0.9说明](CONVENIENCE_STORE_V09.md)。以下旧版本步骤不得跳过新版增量升级。

# Supabase 接通与研究管理（v0.6）

v0.8校园适配：当前测试研究为 `almab-factorial-test-v2`。Supabase已有006的项目仅加007；CloudBase空环境用最新01安装，已安装v0.7的环境仅运行 `cloudbase/02_campus_catalog_upgrade.sql`。旧研究/参与者不得自动迁组。详见 [CAMPUS_ADAPTATION_V08.md](CAMPUS_ADAPTATION_V08.md)。
当前程序已补齐服务器八组分配、购物篮保存与恢复、任务锁定、管理员看板、筛选和CSV导出。尚无实际 Supabase 项目配置，因此本地页面仍是预览，示例看板中的16名参与者是虚构记录。

## 您需要申请什么

1. 到 [Supabase 控制台](https://supabase.com/dashboard)注册自己的账号，创建一个项目（New project）。这不是给学生申请账号；学生会通过本网页在您的项目中验证邮箱或手机号。
2. 项目名称可以用 `almab-campus-shelf`。区域按研究团队的数据存储安排选择；数据库密码由您自行设置和保存。
3. 项目创建后，在 Connect / 项目 API 设置中取得 **Project URL** 和 **publishable key**（`sb_publishable_…`）。项目标识包含在URL中，不用另外申请特殊“ID”。
4. 可把这两项公开配置及最终 GitHub Pages 地址提供给开发人员。**不要发送数据库密码、`sb_secret_`、`service_role`、SMTP密码或短信供应商密钥。**

公开访问密钥只标识网页应用，实际参与者身份由 Auth 验证，管理员读取数据还要通过服务器的权限检查。[官方密钥说明](https://supabase.com/docs/guides/getting-started/api-keys)

## 数据库初始化

在项目 SQL Editor 中，按顺序运行 `supabase/migrations/001_enrollment.sql` 至 `007_campus_catalog_and_zones.sql`，每个文件只运行一次。已有项目只运行尚未执行的增量文件；006不会清空、改组或覆盖001—005的历史队列。

007创建校园适配技术测试研究 `almab-factorial-test-v2`，006保留原v1研究，默认关闭新分配和任务写入，管理员名单为空。

三个因素的编码固定为 P、O、L：

| 因素 | 0 | 1 |
|---|---|---|
| P | 原价 | NOVA4单品加价，候选25% |
| O | 冻结的对照布局 | 替代品在视线层 |
| L | 无营养/UPF标签信息 | 能量、脂肪、糖、盐与UPF组合标签 |

技术测试对照布局为 `targets-eye`，不是经过验证的校园常规布局。位置规则默认 `upf-or-high`，与仅对NOVA4加价的价格对象不同。标签因素检验组合信息效果，不分离颜色、营养信息与UPF信息。正式研究前应确定这些定义。

服务器按1:1:1:1:1:1:1:1的比例使用隐藏的16人随机排列区组，每完整区组每条件2人；未满区组可暂时不均衡。序列存在私有表，网页不接收后续分配。固定区组、是否分层、目标样本量及停止规则属于候选方案，正式招募前应锁定。

## 配置验证码发送

先接邮箱，测试成功后再启用手机号。

- 配置自己的 SMTP 发信服务，并将邮件模板中的验证码设为 `{{ .Token }}`，OTP长度设为6。2026年新建免费项目使用默认发信服务时不能修改认证邮件模板；默认服务还有收件人限制，不适合给学生批量发送。[SMTP说明](https://supabase.com/docs/guides/auth/auth-smtp)、[2026模板变更](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)。
- 如果使用短信，在 Auth 中启用 Phone，并配置支持的短信供应商，确认能向巴基斯坦 `+92` 号码送达。短信供应商账号和密钥由您在服务端配置。[手机登录说明](https://supabase.com/docs/guides/auth/phone-login)
- Auth 的 Site URL 设置为最终 GitHub Pages 项目根网址，包含仓库路径和最后的 `/`。
- 一个联系方式验证一个账号。邮箱和手机号不会自动合并；同一人可能建立多个账号，研究团队仍需用统一编号核查重复参与。

## GitHub Pages 公开变量

在仓库 Settings → Secrets and variables → Actions → Variables 中填写：

| 名称 | 值 |
|---|---|
| SUPABASE_URL | 您的项目 HTTPS URL |
| SUPABASE_PUBLISHABLE_KEY | publishable key |
| PUBLIC_SITE_URL | 最终参与入口，包含仓库路径 |
| STUDY_ID | 技术测试时用 `almab-factorial-test-v2` |
| ENROLLMENT_ENABLED | 初始 `false`，完成服务配置再改 `true` |
| PHONE_AUTH_ENABLED | 初始 `false`，短信实际测试成功再改 `true` |
| CONSENT_VERSION | 测试时例如 `technical-test-v6` |
| INFORMATION_URL_ZH / EN / UR | 三语参与说明的实际HTTPS地址 |

随后运行 Pages 发布工作流。管理员地址为 `https://您的账号.github.io/仓库名/admin.html`，学生入口仍为项目根地址。STUDY_ID为空则沿用历史固定条件试用，不会启用新随机研究；本地单文件始终预览。

## 开放技术测试

仅供研究团队测试，食品数据仍为合成资料。确认上面的参与说明与实际用途一致后，在SQL Editor手动执行：

```sql
begin;
update private.pilot_settings
set consent_version='technical-test-v6',enrollment_open=true where id=true;
update private.studies
set consent_version='technical-test-v6',enrollment_open=true,tasks_open=true
where id='almab-factorial-test-v2';
commit;
```

三处 `CONSENT_VERSION` 必须一致：GitHub变量、登记设置、研究设置。旧的已完整登记资料不会自动重新同意新版本；不要把原试用账号未经处理直接当作新研究样本。新项目使用团队专用测试账号即可。

暂停新增分配：将研究的 `enrollment_open=false`，已有学生仍可恢复并提交；暂停全部任务写入：将 `tasks_open=false`。关闭 `private.pilot_settings.enrollment_open` 会停止新资料登记。已经完成的回执仍可恢复。

## 设置您的管理员权限

Supabase控制台账号与网页管理员账号是两套身份。项目所有者可以管理数据库，但网页要另外授权。

1. 在学生入口用您自己的工作邮箱接收验证码并验证一次，让该邮箱出现在 Supabase Auth 的 Users 中。**不用填写学生人口学表，也不用开始研究任务。**
2. 由项目所有者在 SQL Editor 执行下面的授权，把邮箱占位符替换为刚验证的邮箱：

```sql
do $$
declare admin_id uuid;
begin
 select id into admin_id from auth.users
 where lower(email)=lower('REPLACE_WITH_YOUR_VERIFIED_EMAIL');
 if admin_id is null then raise exception 'No verified web account found'; end if;
 insert into private.study_admins(user_id,can_export)
 values(admin_id,true)
 on conflict(user_id) do update set can_export=excluded.can_export;
end $$;
```

3. 打开 `admin.html`，用同一邮箱重新接收验证码。看板显示八组已分配/完成人数、参与者状态，并可按条件、状态、学校、分配日期（UTC）筛选。点击“查看”读取完整参与者编号及已完成的购买明细。
4. 研究助理仅需查看时，授权的 `can_export` 改为 `false`；撤回权限可由项目所有者修改服务器管理员名单。网页内没有自行成为管理员的入口。

不要将公共页面的隐藏按钮当作权限控制。普通登录者调用管理RPC会被拒绝；管理员不需要在浏览器中输入数据库管理员密钥。

## 数据导出与匹配

- 分析主表CSV：每位已分组者一行，含P/O/L、基线年龄/学校/身体测量、任务状态、购买金额和能量；未完成者结局为空。完成且空篮者能量为0，UPF能量占比为空。
- 商品明细CSV：每次已完成购买的每个食品一行，含数量、原价、实际单价、NOVA、购买营养量及目录版本；空篮和未完成者没有明细行。
- 操作日志CSV：白名单事件、客户端时间和服务器接收时间。不是眼动或可靠注意力测量；最多10,000条/任务，客户端滚动缓冲800条，长期断网可能缺少过程事件，最终购物结果单独保存。
- 食品目录CSV：研究冻结时的完整食品目录。该文件不受参与者筛选影响。
- 字段字典CSV与导出说明JSON：字段含义、版本、筛选、截止时间、文件名和行数。每个文件各自使用服务器截止时间；不同导出不是一个跨文件数据库事务，建议待任务结束后一次完成所需导出。

导出按当前筛选覆盖全部页，每页200行；浏览器上限100,000行，超过时请缩小范围。导出请求在服务器留下时间、请求者、研究、数据集和筛选记录，凭证1小时内有效。

CSV使用UTF-8 BOM，Excel可读中文/乌都语；对可能被表格软件执行的公式字符串加前导单引号。分析导出排除姓名、邮箱、手机号、认证账号ID和完整出生日期，仍属于可关联的研究数据。前期问卷编号保持待核对，需在受保护环境中建立明确对照关系。

## 任务保存和实际联调

购物更改约700ms后自动保存。请等待“已保存”再刷新；网络失败时保留页面并重试，未送达服务器的最后更改不保证恢复。自动重试约每10秒一次。服务器使用版本号防止另一设备的旧购物篮覆盖新记录；发生冲突需要刷新。

同一研究和参与者只有一个服务器任务。完成后结果不可覆盖，也不会再生成第二个正式样本；同一提交重试返回原回执。购物未提交者仍保留分组记录。

研究第一次分配后，配置、目录和规则版本冻结，不能中途切换加价或布局。需要正式方案、审核食品或不同规则时应创建新的研究ID，并同步前端目录与分级代码，不能仅把合成标志改为false。不同研究的参与说明/再次同意流程需要另外处理。

接通真实服务后，由团队测试账号验证：邮箱首次和再次登录、+92短信（启用时）、刷新恢复、断网重试、两页同时编辑、完成后锁定、未完成/空篮导出、普通用户无法访问看板。**本地PostgreSQL和浏览器检查不代表邮件、短信或托管服务已经联调成功。**
