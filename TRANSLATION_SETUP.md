# 翻译API配置指南

本项目使用腾讯云机器翻译API进行文本翻译。

## 获取腾讯云API密钥

### 1. 注册/登录腾讯云

访问 [腾讯云官网](https://cloud.tencent.com/) 并登录您的账号。

### 2. 开通机器翻译服务

1. 访问 [机器翻译控制台](https://console.cloud.tencent.com/tmt)
2. 点击"立即开通"
3. 阅读并同意服务协议

### 3. 获取API密钥

1. 访问 [API密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 点击"新建密钥"
3. 记录生成的 `SecretId` 和 `SecretKey`

### 4. 配置环境变量

在项目根目录的 `.env` 文件中添加：

```env
# 腾讯云翻译API配置
TENCENT_SECRET_ID="你的SecretId"
TENCENT_SECRET_KEY="你的SecretKey"
```

## 免费额度

- **免费额度**：500万字符/月
- **超额收费**：49元/100万字符
- **QPS限制**：5次/秒

## 注意事项

1. **保护密钥安全**：不要将密钥提交到版本控制系统
2. **监控使用量**：定期检查 [控制台](https://console.cloud.tencent.com/tmt) 查看用量
3. **错误处理**：翻译失败时会自动返回原文，不会中断程序

## 如何测试

1. 确保配置了正确的API密钥
2. 访问 http://localhost:3001
3. 点击"翻译"按钮测试翻译功能
4. 查看控制台日志确认翻译请求

## 故障排查

### 问题：翻译失败，返回原文

**可能原因：**
- API密钥未配置或配置错误
- 超出免费额度
- 网络连接问题

**解决方法：**
1. 检查 `.env` 文件中的密钥配置
2. 查看控制台日志获取详细错误信息
3. 访问腾讯云控制台检查用量和账户状态

### 问题：提示"腾讯云翻译API未配置"

**解决方法：**
确保在 `.env` 文件中正确配置了：
```env
TENCENT_SECRET_ID="your-secret-id"
TENCENT_SECRET_KEY="your-secret-key"
```

## 替代方案

如果腾讯云翻译不可用，可以考虑以下替代方案：

1. **DeepL API** - 50万字符/月，质量最高
2. **Microsoft Translator** - 200万字符/月
3. **百度翻译** - 100万字符/月（需认证）
4. **LibreTranslate** - 开源免费方案

详见项目文档了解如何切换翻译服务。
