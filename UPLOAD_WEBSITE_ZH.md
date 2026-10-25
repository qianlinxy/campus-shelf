> v0.10：冷藏冷冻一体柜，新布局v5、新测试研究 `almab-factorial-test-v4`。已有v0.9的Supabase仅运行009，CloudBase仅运行04；登记仍关闭。见 [最新说明](COMBINED_COLD_CABINET_V010.md)。

> v0.9：当前目录75种、新测试研究 `almab-factorial-test-v3`。已完成007的Supabase仅运行008；CloudBase已完成v0.8仅运行03升级；v0.7先02再03；空环境才使用01。登记仍关闭。详见 [v0.9说明](CONVENIENCE_STORE_V09.md)。以下旧版本步骤不得跳过新版增量升级。

# 上传网页版：GitHub Pages 或腾讯云 CloudBase

v0.8校园适配：当前测试研究为 `almab-factorial-test-v2`。Supabase已有006的项目仅加007；CloudBase空环境用最新01安装，已安装v0.7的环境仅运行 `cloudbase/02_campus_catalog_upgrade.sql`。旧研究/参与者不得自动迁组。详见 [CAMPUS_ADAPTATION_V08.md](CAMPUS_ADAPTATION_V08.md)。
使用 `Campus_Shelf_v08_Website.zip`，先解压。此包只有已经生成的网页文件，根目录即有 index.html；与包含数据库和测试文件的完整源码包用途不同。

## 腾讯云 CloudBase

1. 进入 https://tcb.cloud.tencent.com/ ，选择环境 `monetary-dinosaur-d0d39pf87e5f20`。
2. 进入「静态网站托管 → 文件管理」。如服务尚未开通，按控制台实际显示的套餐和条款由环境所有者开通。
3. 在网站根目录上传解压后的文件和 vendor 文件夹，保持目录结构。上传后根目录应直接显示 index.html 和 admin.html。
4. 如果使用「新建部署 → 上传代码包」，可直接选择 Website.zip。纯静态项目的安装命令、构建命令留空，产物目录选 `.`，部署路径选 `/`。
5. 使用控制台显示的实际访问域名测试。学生首页为该地址，管理员入口为该地址下的 /admin.html。
6. 文件上传方案无需 GitHub 授权。默认域名用于技术试用，正式使用按控制台要求配置正式域名并测试校园网络。

## GitHub Pages（网页上传方案）

1. 打开 https://github.com/qianlinxy/campus-shelf 。
2. 空仓库点击「uploading an existing file」；已有文件的仓库点击「Add file → Upload files」。
3. 将解压后的文件和 vendor 文件夹拖入上传区。index.html 必须在仓库根目录，不能多套一层文件夹，也不要只上传 ZIP 文件。
4. 填写提交说明并提交至 main。
5. 进入「Settings → Pages → Build and deployment」。Source 选「Deploy from a branch」，Branch 选 main，Folder 选 /(root)，点击 Save。
6. 等待 GitHub 显示部署成功，访问 https://qianlinxy.github.io/campus-shelf/ 。管理员入口为 https://qianlinxy.github.io/campus-shelf/admin.html 。

这条方案使用网站发布包与分支发布，无需上传隐藏的 .github 工作流。完整源码包如需 GitHub Actions 部署，另按 CLOUDBASE_GITHUB_GUIDE.md 操作，不要混用两套入口。

## 上传后还需要接通数据

网站文件中已配置 CloudBase 环境 ID，登记仍为关闭。上传成功可以浏览三语货架，但不会自动完成研究数据库和邮箱认证配置。

接下来依次核对 cloudbase/00_preflight.sql、首次安装 cloudbase/01_install.sql、邮箱验证码与邮件代发、实际网站主机名的安全来源、真实参与说明与同意版本，再进行团队测试。详细步骤见 CLOUDBASE_GITHUB_GUIDE.md。

网站发布包的 publicSiteUrl 为空，二维码使用当前网站地址。确定正式域名后可设置该值。更换网页主机不需要更换 CloudBase 数据库。

参考：
- https://docs.cloudbase.net/hosting/quick-start
- https://docs.cloudbase.net/hosting/web-hosting-static
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
