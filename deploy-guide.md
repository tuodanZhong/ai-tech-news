# 服务器部署指南

## 一、上传项目到服务器

### 方法1：使用 Git（推荐）

```bash
# SSH 连接到服务器
ssh your-user@your-server-ip

# 进入你想要部署的目录
cd ~  # 或者 cd /var/www

# 克隆项目
git clone https://github.com/tuodanZhong/ai-tech-news.git
cd ai-tech-news
```

### 方法2：直接上传（如果服务器无法访问 GitHub）

```bash
# 在本地打包项目
cd /Users/yingzhang/Desktop/AiStudy/科技日报/tech-news
tar -czf tech-news.tar.gz --exclude='node_modules' --exclude='.next' --exclude='.git' .

# 上传到服务器
scp tech-news.tar.gz your-user@your-server-ip:~/

# 在服务器上解压
ssh your-user@your-server-ip
mkdir -p ~/tech-news
cd ~/tech-news
tar -xzf ~/tech-news.tar.gz
```

## 二、配置环境变量

```bash
# 在服务器上创建 .env 文件
cd ~/tech-news  # 或你的项目目录
nano .env
```

复制以下内容并替换为你的真实信息：

```env
# 数据库连接
DATABASE_URL="postgresql://用户名:密码@主机:5432/数据库名?schema=public"

# DeepSeek API
DEEPSEEK_API_KEY="你的-deepseek-api-key"

# 腾讯云翻译 API
TENCENTCLOUD_SECRET_ID="你的-secret-id"
TENCENTCLOUD_SECRET_KEY="你的-secret-key"

# Firecrawl API（可选）
FIRECRAWL_API_KEY="你的-firecrawl-api-key"

# 应用 URL
NEXT_PUBLIC_APP_URL="http://你的服务器IP:8765"
```

保存并退出（Ctrl + O，Enter，Ctrl + X）

## 三、安装依赖并构建

```bash
# 确保在项目目录
cd ~/tech-news

# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 同步数据库表结构
npx prisma db push

# 构建生产版本
npm run build

# 创建日志目录
mkdir -p logs
```

## 四、创建 PM2 配置文件

```bash
# 创建 ecosystem.config.js
nano ecosystem.config.js
```

复制以下内容（**注意修改 cwd 路径**）：

```javascript
module.exports = {
  apps: [{
    name: 'tech-news',
    script: 'npm',
    args: 'start',
    cwd: '/home/your-user/tech-news',  // ⚠️ 修改为你的实际路径
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8765
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

保存并退出

## 五、启动服务

```bash
# 如果之前运行过同名服务，先删除
pm2 delete tech-news

# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs tech-news --lines 50

# 保存 PM2 配置
pm2 save

# 设置开机自启（首次部署执行一次即可）
pm2 startup
# 复制输出的命令并执行
```

## 六、配置定时任务

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每小时执行一次）
0 * * * * curl -X GET "http://localhost:8765/api/cron-job" >> /home/your-user/tech-news/logs/cron.log 2>&1
```

保存并退出

## 七、防火墙配置

```bash
# 开放 8765 端口（如果使用了防火墙）
sudo ufw allow 8765

# 查看防火墙状态
sudo ufw status
```

## 八、验证部署

```bash
# 测试 API
curl http://localhost:8765/api/articles

# 在浏览器访问
http://你的服务器IP:8765
```

## 九、常用管理命令

```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart tech-news

# 停止服务
pm2 stop tech-news

# 查看实时日志
pm2 logs tech-news

# 监控资源
pm2 monit

# 更新代码（如果用 Git）
cd ~/tech-news
git pull
npm install
npm run build
pm2 restart tech-news

# 手动执行定时任务
curl http://localhost:8765/api/cron-job

# 清理数据库
npm run db:clear
```

## 十、配置 Nginx 反向代理（可选）

如果你想通过 80 端口访问或绑定域名：

```bash
# 安装 Nginx
sudo apt install nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/tech-news
```

添加以下内容：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;

    location / {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/tech-news /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 开放 80 端口
sudo ufw allow 80
```

## 故障排查

### 服务无法启动

```bash
# 查看错误日志
pm2 logs tech-news --err

# 查看详细日志
cat ~/tech-news/logs/err.log
```

### 数据库连接失败

```bash
# 检查环境变量
cat .env

# 测试数据库连接
npx prisma db push
```

### 端口被占用

```bash
# 查看 8765 端口占用
lsof -i :8765

# 或者
netstat -tulpn | grep 8765

# 修改端口（在 package.json 和 ecosystem.config.js 中修改）
```

---

## 快速部署脚本（一键执行）

将所有命令整合成一个脚本，在下一个文件中...
