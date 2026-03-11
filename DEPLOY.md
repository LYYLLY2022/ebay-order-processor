# eBay 订单处理系统 - 部署指南

本应用是纯前端应用，可以部署到任何支持静态文件托管的服务上。以下是几种常见的部署方式：

## 部署方式对比

| 部署方式 | 优点 | 缺点 | 推荐度 |
|---------|------|------|--------|
| GitHub Pages | 免费、简单、自动部署 | 国内访问较慢 | ⭐⭐⭐⭐ |
| Vercel | 全球加速、免费 | 需要注册 | ⭐⭐⭐⭐⭐ |
| CloudBase | 国内访问快、免费额度 | 需要腾讯云账号 | ⭐⭐⭐⭐⭐ |
| 传统服务器 | 完全控制 | 需要配置和维护 | ⭐⭐⭐ |

---

## 方式一：GitHub Pages（推荐，免费）

### 步骤 1：准备代码仓库
```bash
cd d:/claw/订单处理

# 初始化 Git 仓库
git init

# 创建 .gitignore
echo "node_modules/" > .gitignore

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"
```

### 步骤 2：创建 GitHub 仓库
1. 访问 https://github.com/new
2. 创建新仓库（例如：ebay-order-processor）
3. 不要初始化 README

### 步骤 3：推送代码到 GitHub
```bash
# 添加远程仓库
git remote add origin https://github.com/你的用户名/ebay-order-processor.git

# 推送代码
git branch -M main
git push -u origin main
```

### 步骤 4：启用 GitHub Pages
1. 进入仓库的 **Settings** 页面
2. 左侧菜单找到 **Pages**
3. 在 **Build and deployment** 中：
   - Source: 选择 **Deploy from a branch**
   - Branch: 选择 **main** 分支，文件夹选择 **/(root)**
4. 点击 **Save**

### 步骤 5：等待部署
- 约 1-2 分钟后，访问显示的 URL
- 格式：`https://你的用户名.github.io/ebay-order-processor/`

---

## 方式二：Vercel（推荐，全球加速）

### 步骤 1：准备代码仓库
按照 GitHub Pages 的步骤 1-3 完成 Git 仓库创建

### 步骤 2：部署到 Vercel
1. 访问 https://vercel.com
2. 使用 GitHub 账号登录
3. 点击 **Add New** → **Project**
4. 选择你的 GitHub 仓库
5. 点击 **Deploy**

### 步骤 3：获取访问地址
- Vercel 会自动生成访问地址
- 格式：`https://你的项目名.vercel.app`

---

## 方式三：腾讯云 CloudBase（推荐，国内访问快）

### 步骤 1：安装 CloudBase CLI
```bash
npm install -g @cloudbase/cli
```

### 步骤 2：登录
```bash
cloudbase login
```

### 步骤 3：初始化项目
```bash
cd d:/claw/订单处理
cloudbase init
```

### 步骤 4：部署
```bash
cloudbase hosting deploy
```

### 步骤 5：获取访问地址
- 部署成功后会显示访问 URL
- 格式：`https://你的环境ID.tcb.qcloud.la`

---

## 方式四：使用 Cloud Studio 快速部署

### 步骤 1：准备文件
确保项目包含以下文件：
```
订单处理/
├── index.html
├── app.js
└── README.md
```

### 步骤 2：使用 Cloud Studio 部署
1. 在 IDE 中点击集成菜单的 CloudStudio
2. 选择部署配置
3. 选择静态网站部署
4. 上传文件到 `d:/claw/订单处理` 目录
5. 点击部署

---

## 方式五：传统服务器部署

### 步骤 1：上传文件
使用 FTP/SFTP 工具将文件上传到服务器的 web 目录：
- Apache: `/var/www/html/`
- Nginx: `/usr/share/nginx/html/`

### 步骤 2：配置服务器（可选）
如果使用 Nginx，添加配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/订单处理;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 步骤 3：重启服务器
```bash
# Apache
sudo systemctl restart apache2

# Nginx
sudo systemctl restart nginx
```

---

## 数据安全说明

本应用具有以下安全特性：

### ✅ 纯前端处理
- 所有数据处理在用户浏览器中完成
- 数据不会上传到任何服务器
- XML 文件只在本地解析

### ✅ 无后端依赖
- 不需要数据库
- 不需要 API 接口
- 不需要用户登录

### ✅ 开源透明
- 代码完全开源
- 可自行审查安全性
- 支持本地部署

---

## 域名配置（可选）

### 绑定自定义域名

#### GitHub Pages
1. 仓库 **Settings** → **Pages**
2. 在 **Custom domain** 输入域名
3. 在域名 DNS 中添加 CNAME 记录：
   - 主机记录：`www`
   - 记录值：`你的用户名.github.io`

#### Vercel
1. 项目 **Settings** → **Domains**
2. 添加自定义域名
3. 按提示配置 DNS

---

## HTTPS 配置

大部分托管平台会自动提供 HTTPS：

| 平台 | HTTPS | 证书 |
|------|-------|------|
| GitHub Pages | ✅ | Let's Encrypt |
| Vercel | ✅ | Let's Encrypt |
| CloudBase | ✅ | 腾讯云 SSL |
| 自建服务器 | ⚠️ | 需自行配置 |

---

## 访问控制（可选）

如果需要限制访问，可以：

### 1. 使用 Cloudflare Access
- 在 Cloudflare 中配置 Access
- 只有授权用户可以访问

### 2. 添加简单密码保护
修改 `index.html`，在 `<body>` 标签后添加：
```html
<script>
if (!sessionStorage.getItem('authenticated')) {
    const password = prompt('请输入访问密码：');
    if (password !== '你的密码') {
        document.body.innerHTML = '<h1>访问被拒绝</h1>';
    } else {
        sessionStorage.setItem('authenticated', 'true');
    }
}
</script>
```

### 3. IP 白名单（服务器级别）
在 Nginx/Apache 配置中添加 IP 限制

---

## 性能优化建议

### 1. 启用 CDN 加速
- 将静态资源上传到 CDN
- 使用 Cloudflare、阿里云 CDN 等

### 2. 压缩资源
```bash
# 压缩 HTML
npm install -g html-minifier
html-minifier --collapse-whitespace --remove-comments index.html -o index.min.html

# 压缩 JS
npm install -g terser
terser app.js -o app.min.js
```

### 3. 添加缓存策略
在服务器配置中添加：
```nginx
location ~* \.(js|css)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

---

## 监控与日志

### 使用 Google Analytics
在 `index.html` 的 `<head>` 中添加：
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXX');
</script>
```

---

## 故障排除

### 问题：页面无法加载
- 检查文件是否正确上传
- 检查服务器配置
- 查看浏览器控制台错误

### 问题：404 错误
- 检查文件路径是否正确
- 检查 Nginx/Apache 配置

### 问题：CORS 错误
- 本地应用不会有 CORS 问题
- 确保所有资源同源加载

---

## 联系支持

如有问题，请查看：
- GitHub Issues（如使用 GitHub）
- 平台官方文档
- README.md 文档

---

## 更新部署

### 自动更新（Git）
```bash
git add .
git commit -m "Update"
git push
```

### 手动更新
1. 修改本地文件
2. 重新部署到平台

---

## 成本估算

| 部署方式 | 月成本 | 流量限制 |
|---------|--------|----------|
| GitHub Pages | 免费 | 100GB/月 |
| Vercel | 免费 | 100GB/月 |
| CloudBase | 免费额度 | 5GB/月 |
| 自建服务器 | $5-50/月 | 自定义 |

---

**推荐选择**：
- 🌍 国际用户：GitHub Pages 或 Vercel
- 🇨🇳 国内用户：腾讯云 CloudBase 或 Cloud Studio
- 💰 完全免费：GitHub Pages
- ⚡ 性能优先：Vercel
- 🔒 数据安全：所有方式都支持（纯前端）
