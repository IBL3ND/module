/**
 * @name 山丘阅读 (Hill Read) 综合优化脚本
 * @description 修复版：支持 VIP 状态修改，并精准拦截 config2025 接口去除各类广告，保留核心阅读功能
 * @version 3.0.0 (Refactored)
 */

let requestUrl = $request.url;
let bodyStr = $response.body;
let body;

// 1. 安全解析 JSON，防止非 JSON 响应导致脚本崩溃
try {
    body = JSON.parse(bodyStr);
} catch (e) {
    $done({}); // 解析失败则原样放行
}

// 2. 匹配请求接口 (兼容新旧版本)
const resetApi = /resetvip/;
const infoApi = /myinfo/;
const addApi = /addsecond/;
const configApi = /config2020|config2025/; // 同时兼容旧版和新版 v2 接口

// 3. 格式化请求 URI 参数
let requestParams = requestUrl.includes('?') ? requestUrl.split('?')[1].split('&') : [];
let params = {};
for (let i in requestParams) {
    let parts = requestParams[i].split('=');
    if (parts.length === 2) {
        params[parts[0]] = parts[1];
    }
}

// ==========================================
// 模块 A: 用户信息接口处理 (VIP 状态修改)
// ==========================================
if (requestUrl.match(infoApi) && body.status === "1" && body.data && body.data.length > 0) {
    let temp = body.data[0];
    temp.type = "9"; // 9 代表终身会员
    temp.vipto = "2099-12-31 00:00:00";
    temp.banned = "0";
    
    // 【修复】移除了原脚本中不雅的 nickname，改为正常显示
    temp.nickname = temp.nickname && temp.nickname.trim() !== "" ? temp.nickname : "尊贵会员";
    
    // 保留原有的 token, device, uid 等动态参数
    if (params.token) temp.token = params.token;
    if (params.device) temp.device = params.device;
    if (params.uid) temp.uuid = params.uid;
    
    body.data[0] = temp;
}

// ==========================================
// 模块 B: 绑定接口处理
// ==========================================
if (requestUrl.match(addApi)) {
    body.status = "1";
    body.data = "绑定成功";
}

// ==========================================
// 模块 C: 配置接口处理 (核心去广告逻辑)
// ==========================================
if (requestUrl.match(configApi) && body.status === "1" && Array.isArray(body.data)) {
    
    // 【修复】彻底移除了原脚本中破坏性的 "data.length = 0" 逻辑
    // 改为遍历数组，仅针对广告相关的 cokey 进行修改，其他配置（如书源、净化规则）原样保留
    
    body.data = body.data.map(item => {
        if (!item || !item.cokey) return item;

        switch (item.cokey) {
            case "adconfig":
                // 清空自营开屏提示图/内购引导
                item.covalue = "[]";
                break;
            case "PARAV2_SPLASHADS_CONFIG":
                // 清空第三方开屏广告配置 (穿山甲/优量汇等)
                item.covalue = "";
                break;
            case "ONLINE_ENABLE_REWARDAD":
            case "ONLINE_ENABLE_REWARDAD_V735":
                // 禁用激励视频广告开关
                item.covalue = "disable";
                break;
            case "ONLINE_REWARDAD_CONFIG":
            case "ONLINE_REWARDAD_CONFIG_V735":
            case "ONLINE_INTERAD_DOWNLOAD_CONFIG":
            case "ONLINE_INTERAD_DOWNLOAD_CONFIG_V735":
                // 清空激励视频和插屏广告的具体配置参数
                item.covalue = "";
                break;
            default:
                // 其他所有配置（如 ONLINE_TXTSITES, ONLINE_ADAWAY_STRING 等）保持原样，不做任何修改
                break;
        }
        return item;
    });
}

// 4. 返回修改后的数据
$done({ body: JSON.stringify(body) });
