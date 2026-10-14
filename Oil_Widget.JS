/**
 * ⛽ 全国实时油价小组件
 * 数据源：http://m.qiyoujiage.com/
 * 脚本作者：Egern 群友 tg://user?id=5122789128
 * 由 iBL3ND 二次修改
 * 
 * 🔧 功能特性：
 * - 支持全国所有省份和城市
 * - 标题自动显示当前填写的地区
 * - 实时显示 92/95/98 号汽油和柴油价格
 * - 深色模式自动适配
 * - 全 iPhone 机型适配
 * - 支持锁屏小组件（单行 / 圆形 / 矩形）
 * 
 * 📚 使用教程
 * ═══════════════════════════════════════════════════
 *
 * 1️⃣ 环境变量配置
 * ─────────────────────────────────────────────────
 * 在 Egern 小组件 编辑里面 添加环境变量 中添加
 *
 * 名称：region
 * 值：省份/城市（拼音，用 / 分隔）
 *
 * 名称：SHOW_TREND
 * 值：true（显示调价趋势）或 false（不显示）
 *
 *
 * 2️⃣ 地区代码对照表
 * ─────────────────────────────────────────────────
 * 【直辖市】
 * • 北京：beijing  • 上海：shanghai
 * • 天津：tianjin  • 重庆：chongqing
 *
 * 【省份 - 省会城市】
 * • 广东：guangdong/guangzhou
 * • 江苏：jiangsu/nanjing
 * • 浙江：zhejiang/hangzhou
 * • 山东：shandong/jinan
 * • 河南：henan/zhengzhou
 * • 河北：hebei/shijiazhuang
 * • 四川：sichuan/chengdu
 * • 湖北：hubei/wuhan
 * • 湖南：hunan/changsha
 * • 安徽：anhui/hefei
 * • 福建：fujian/fuzhou
 * • 江西：jiangxi/nanchang
 * • 辽宁：liaoning/shenyang
 * • 陕西：shanxi-3/xian  ⚠️
 * • 海南：hainan/haikou
 * • 山西：shanxi-1/taiyuan  ⚠️
 * • 吉林：jilin/changchun
 * • 黑龙江：heilongjiang/haerbin
 * • 云南：yunnan/kunming
 * • 贵州：guizhou/guiyang
 * • 广西：guangxi/nanning
 * • 甘肃：gansu/lanzhou
 * • 青海：qinghai/xining
 * • 宁夏：ningxia/yinchuan
 * • 新疆：xinjiang/wulumuqi
 * • 西藏：xizang/lasa
 * • 内蒙古：neimenggu/huhehaote
 * • 也可以去 http://m.qiyoujiage.com/shanxi-3.shtml 查看自己省份拼音
 * ═══════════════════════════════════════════════════
 */

export default async function (ctx) {
  // 中文地区名 → 拼音路径映射（模块图形化选择用）
  const REGION_MAP = {
    '北京': 'beijing',
    '上海': 'shanghai',
    '天津': 'tianjin',
    '重庆': 'chongqing',
    '广东-深圳': 'guangdong/shenzhen',
    '广东-广州': 'guangdong/guangzhou',
    '广东-韶关': 'guangdong/shaoguan',
    '广东-珠海': 'guangdong/zhuhai',
    '广东-汕头': 'guangdong/shantou',
    '广东-佛山': 'guangdong/foshan',
    '广东-江门': 'guangdong/jiangmen',
    '广东-湛江': 'guangdong/zhanjiang',
    '广东-茂名': 'guangdong/maoming',
    '广东-肇庆': 'guangdong/zhaoqing',
    '广东-惠州': 'guangdong/huizhou',
    '广东-梅州': 'guangdong/meizhou',
    '广东-汕尾': 'guangdong/shanwei',
    '广东-河源': 'guangdong/heyuan',
    '广东-阳江': 'guangdong/yangjiang',
    '广东-清远': 'guangdong/qingyuan',
    '广东-东莞': 'guangdong/dongguan',
    '广东-中山': 'guangdong/zhongshan',
    '广东-潮州': 'guangdong/chaozhou',
    '广东-揭阳': 'guangdong/jieyang',
    '广东-云浮': 'guangdong/yunfu',
    '江苏-南京': 'jiangsu/nanjing',
    '江苏-无锡': 'jiangsu/wuxi',
    '江苏-徐州': 'jiangsu/xuzhou',
    '江苏-常州': 'jiangsu/changzhou',
    '江苏-苏州': 'jiangsu/suzhou',
    '江苏-南通': 'jiangsu/nantong',
    '江苏-连云港': 'jiangsu/lianyungang',
    '江苏-淮安': 'jiangsu/huaian',
    '江苏-盐城': 'jiangsu/yancheng',
    '江苏-扬州': 'jiangsu/yangzhou',
    '江苏-镇江': 'jiangsu/zhenjiang',
    '江苏-泰州': 'jiangsu/taizhou',
    '江苏-宿迁': 'jiangsu/suqian',
    '浙江-杭州': 'zhejiang/hangzhou',
    '浙江-宁波': 'zhejiang/ningbo',
    '浙江-温州': 'zhejiang/wenzhou',
    '浙江-嘉兴': 'zhejiang/jiaxing',
    '浙江-湖州': 'zhejiang/huzhou',
    '浙江-绍兴': 'zhejiang/shaoxing',
    '浙江-金华': 'zhejiang/jinhua',
    '浙江-衢州': 'zhejiang/quzhou',
    '浙江-舟山': 'zhejiang/zhoushan',
    '浙江-台州': 'zhejiang/taizhou',
    '浙江-丽水': 'zhejiang/lishui',
    '山东-济南': 'shandong/jinan',
    '山东-青岛': 'shandong/qingdao',
    '山东-淄博': 'shandong/zibo',
    '山东-枣庄': 'shandong/zaozhuang',
    '山东-东营': 'shandong/dongying',
    '山东-烟台': 'shandong/yantai',
    '山东-潍坊': 'shandong/weifang',
    '山东-济宁': 'shandong/jining',
    '山东-泰安': 'shandong/taian',
    '山东-威海': 'shandong/weihai',
    '山东-日照': 'shandong/rizhao',
    '山东-莱芜': 'shandong/laiwu',
    '山东-临沂': 'shandong/linyi',
    '山东-德州': 'shandong/dezhou',
    '山东-聊城': 'shandong/liaocheng',
    '山东-滨州': 'shandong/binzhou',
    '山东-菏泽市': 'shandong/heze',
    '河南-郑州': 'henan/zhengzhou',
    '河南-开封': 'henan/kaifeng',
    '河南-洛阳': 'henan/luoyang',
    '河南-平顶山': 'henan/pingdingshan',
    '河南-安阳': 'henan/anyang',
    '河南-鹤壁': 'henan/hebi',
    '河南-新乡': 'henan/xinxiang',
    '河南-焦作': 'henan/jiaozuo',
    '河南-濮阳': 'henan/puyang',
    '河南-许昌': 'henan/xuchang',
    '河南-漯河': 'henan/luohe',
    '河南-三门峡': 'henan/sanmenxia',
    '河南-南阳': 'henan/nanyang',
    '河南-商丘': 'henan/shangqiu',
    '河南-信阳': 'henan/xinyang',
    '河南-周口': 'henan/zhoukou',
    '河南-驻马店': 'henan/zhumadian',
    '河北-石家庄': 'hebei/shijiazhuang',
    '河北-唐山': 'hebei/tangshan',
    '河北-秦皇岛': 'hebei/qinhuangdao',
    '河北-邯郸': 'hebei/handan',
    '河北-邢台': 'hebei/xingtai',
    '河北-保定': 'hebei/baoding',
    '河北-张家口': 'hebei/zhangjiakou',
    '河北-承德': 'hebei/chengde',
    '河北-沧州': 'hebei/cangzhou',
    '河北-廊坊': 'hebei/langfang',
    '河北-衡水': 'hebei/hengshui',
    '四川-成都': 'sichuan/chengdu',
    '四川-自贡': 'sichuan/zigong',
    '四川-攀枝花': 'sichuan/panzhihua',
    '四川-泸州': 'sichuan/luzhou',
    '四川-德阳': 'sichuan/deyang',
    '四川-绵阳': 'sichuan/mianyang',
    '四川-广元': 'sichuan/guangyuan',
    '四川-遂宁': 'sichuan/suining',
    '四川-内江': 'sichuan/neijiang',
    '四川-乐山': 'sichuan/leshan',
    '四川-南充': 'sichuan/nanchong',
    '四川-眉山': 'sichuan/meishan',
    '四川-宜宾': 'sichuan/yibin',
    '四川-广安': 'sichuan/guangan',
    '四川-达州': 'sichuan/dazhou',
    '四川-雅安': 'sichuan/yaan',
    '四川-巴中': 'sichuan/bazhong',
    '四川-资阳': 'sichuan/ziyang',
    '四川-阿坝': 'sichuan/aba',
    '四川-甘孜': 'sichuan/ganzi',
    '四川-凉山': 'sichuan/liangshan',
    '湖北-武汉': 'hubei/wuhan',
    '湖北-黄石': 'hubei/huangshi',
    '湖北-十堰': 'hubei/shiyan',
    '湖北-宜昌': 'hubei/yichang',
    '湖北-襄樊': 'hubei/xiangfan',
    '湖北-鄂州': 'hubei/ezhou',
    '湖北-荆门': 'hubei/jingmen',
    '湖北-孝感': 'hubei/xiaogan',
    '湖北-荆州': 'hubei/jingzhou',
    '湖北-黄冈': 'hubei/huanggang',
    '湖北-咸宁': 'hubei/xianning',
    '湖北-随州': 'hubei/suizhou',
    '湖北-恩施': 'hubei/enshi',
    '湖南-长沙': 'hunan/changsha',
    '湖南-株洲': 'hunan/zhuzhou',
    '湖南-湘潭': 'hunan/xiangtan',
    '湖南-衡阳': 'hunan/hengyang',
    '湖南-邵阳': 'hunan/shaoyang',
    '湖南-岳阳': 'hunan/yueyang',
    '湖南-常德': 'hunan/changde',
    '湖南-张家界': 'hunan/zhangjiajie',
    '湖南-益阳': 'hunan/yiyang',
    '湖南-郴州': 'hunan/chenzhou',
    '湖南-永州': 'hunan/yongzhou',
    '湖南-怀化': 'hunan/huaihua',
    '湖南-娄底': 'hunan/loudi',
    '湖南-湘西': 'hunan/xiangxi',
    '安徽-合肥': 'anhui/hefei',
    '安徽-芜湖': 'anhui/wuhu',
    '安徽-蚌埠': 'anhui/bengbu',
    '安徽-淮南': 'anhui/huainan',
    '安徽-马鞍山': 'anhui/maanshan',
    '安徽-淮北': 'anhui/huaibei',
    '安徽-铜陵': 'anhui/tongling',
    '安徽-安庆': 'anhui/anqing',
    '安徽-黄山': 'anhui/huangshan',
    '安徽-滁州': 'anhui/chuzhou',
    '安徽-阜阳': 'anhui/fuyang',
    '安徽-宿州': 'anhui/suzhou',
    '安徽-巢湖': 'anhui/chaohu',
    '安徽-六安': 'anhui/luan',
    '安徽-亳州': 'anhui/bozhou',
    '安徽-池州': 'anhui/chizhou',
    '安徽-宣城': 'anhui/xuancheng',
    '福建-福州': 'fujian/fuzhou',
    '福建-厦门': 'fujian/xiamen',
    '福建-莆田': 'fujian/putian',
    '福建-三明': 'fujian/sanming',
    '福建-泉州': 'fujian/quanzhou',
    '福建-漳州': 'fujian/zhangzhou',
    '福建-南平': 'fujian/nanping',
    '福建-龙岩': 'fujian/longyan',
    '福建-宁德': 'fujian/ningde',
    '江西-南昌': 'jiangxi/nanchang',
    '江西-景德镇': 'jiangxi/jingdezhen',
    '江西-萍乡': 'jiangxi/pingxiang',
    '江西-九江': 'jiangxi/jiujiang',
    '江西-新余': 'jiangxi/xinyu',
    '江西-鹰潭': 'jiangxi/yingtan',
    '江西-赣州': 'jiangxi/ganzhou',
    '江西-吉安': 'jiangxi/jian',
    '江西-宜春': 'jiangxi/yichun',
    '江西-抚州': 'jiangxi/fuzhou',
    '江西-上饶': 'jiangxi/shangrao',
    '辽宁-沈阳': 'liaoning/shenyang',
    '辽宁-大连': 'liaoning/dalian',
    '辽宁-鞍山': 'liaoning/anshan',
    '辽宁-抚顺': 'liaoning/fushun',
    '辽宁-本溪': 'liaoning/benxi',
    '辽宁-丹东': 'liaoning/dandong',
    '辽宁-锦州': 'liaoning/jinzhou',
    '辽宁-营口': 'liaoning/yingkou',
    '辽宁-阜新': 'liaoning/fuxin',
    '辽宁-辽阳': 'liaoning/liaoyang',
    '辽宁-盘锦': 'liaoning/panjin',
    '辽宁-铁岭': 'liaoning/tieling',
    '辽宁-朝阳': 'liaoning/chaoyang',
    '辽宁-葫芦岛': 'liaoning/huludao',
    '陕西-西安': 'shanxi-3/xian',
    '陕西-铜川': 'shanxi-3/tongchuan',
    '陕西-宝鸡': 'shanxi-3/baoji',
    '陕西-咸阳': 'shanxi-3/xianyang',
    '陕西-渭南': 'shanxi-3/weinan',
    '陕西-延安': 'shanxi-3/yanan',
    '陕西-汉中': 'shanxi-3/hanzhong',
    '陕西-榆林': 'shanxi-3/yulin',
    '陕西-安康': 'shanxi-3/ankang',
    '陕西-商洛': 'shanxi-3/shangluo',
    '海南-海口': 'hainan/haikou',
    '海南-三亚': 'hainan/sanya',
    '山西-太原': 'shanxi/taiyuan',
    '山西-大同': 'shanxi/datong',
    '山西-阳泉': 'shanxi/yangquan',
    '山西-长治': 'shanxi/changzhi',
    '山西-晋城': 'shanxi/jincheng',
    '山西-朔州': 'shanxi/shuozhou',
    '山西-晋中': 'shanxi/jinzhong',
    '山西-运城': 'shanxi/yuncheng',
    '山西-忻州': 'shanxi/xinzhou',
    '山西-临汾': 'shanxi/linfen',
    '山西-吕梁': 'shanxi/lvliang',
    '吉林-长春': 'jilin/changchun',
    '吉林-吉林市': 'jilin/jilinshi',
    '吉林-四平': 'jilin/siping',
    '吉林-辽源': 'jilin/liaoyuan',
    '吉林-通化': 'jilin/tonghua',
    '吉林-白山': 'jilin/baishan',
    '吉林-松原': 'jilin/songyuan',
    '吉林-白城': 'jilin/baicheng',
    '吉林-延边': 'jilin/yanbian',
    '黑龙江-哈尔滨': 'heilongjiang/haerbin',
    '黑龙江-齐齐哈尔': 'heilongjiang/qiqihar',
    '黑龙江-鸡西': 'heilongjiang/jixi',
    '黑龙江-鹤岗': 'heilongjiang/hegang',
    '黑龙江-双鸭山': 'heilongjiang/shuangyashan',
    '黑龙江-大庆': 'heilongjiang/daqing',
    '黑龙江-伊春市': 'heilongjiang/yichunshi',
    '黑龙江-佳木斯': 'heilongjiang/jiamusi',
    '黑龙江-七台河': 'heilongjiang/qitaihe',
    '黑龙江-牡丹江': 'heilongjiang/mudanjiang',
    '黑龙江-黑河': 'heilongjiang/heihe',
    '黑龙江-绥化': 'heilongjiang/suihua',
    '黑龙江-大兴安岭': 'heilongjiang/daxinganling',
    '云南-昆明': 'yunnan/kunming',
    '云南-曲靖': 'yunnan/qujing',
    '云南-玉溪': 'yunnan/yuxi',
    '云南-保山': 'yunnan/baoshan',
    '云南-昭通': 'yunnan/zhaotong',
    '云南-丽江': 'yunnan/lijiang',
    '云南-普洱': 'yunnan/puer',
    '云南-临沧': 'yunnan/lincang',
    '云南-楚雄': 'yunnan/chuxiong',
    '云南-红河': 'yunnan/honghe',
    '云南-文山': 'yunnan/wenshan',
    '云南-西双版纳': 'yunnan/xishuangbanna',
    '云南-大理': 'yunnan/dali',
    '云南-德宏': 'yunnan/dehong',
    '云南-怒江': 'yunnan/nujiang',
    '云南-迪庆': 'yunnan/diqing',
    '贵州-贵阳': 'guizhou/guiyang',
    '贵州-六盘水': 'guizhou/liupanshui',
    '贵州-遵义': 'guizhou/zunyi',
    '贵州-安顺': 'guizhou/anshun',
    '贵州-铜仁': 'guizhou/tongren',
    '贵州-黔西南': 'guizhou/qianxinan',
    '贵州-毕节': 'guizhou/bijie',
    '贵州-黔东南': 'guizhou/qiandongnan',
    '贵州-黔南': 'guizhou/qiannan',
    '广西-南宁': 'guangxi/nanning',
    '广西-柳州': 'guangxi/liuzhou',
    '广西-桂林': 'guangxi/guilin',
    '广西-梧州': 'guangxi/wuzhou',
    '广西-北海': 'guangxi/beihai',
    '广西-防城港': 'guangxi/fangchenggang',
    '广西-钦州': 'guangxi/qinzhou',
    '广西-贵港': 'guangxi/guigang',
    '广西-玉林': 'guangxi/yulin',
    '广西-百色': 'guangxi/baise',
    '广西-贺州': 'guangxi/hezhou',
    '广西-河池': 'guangxi/hechi',
    '广西-来宾': 'guangxi/laibin',
    '广西-崇左': 'guangxi/chongzuo',
    '甘肃-兰州': 'gansu/lanzhou',
    '甘肃-嘉峪关': 'gansu/jiayuguan',
    '甘肃-金昌': 'gansu/jinchang',
    '甘肃-白银': 'gansu/baiyin',
    '甘肃-天水': 'gansu/tianshui',
    '甘肃-武威': 'gansu/wuwei',
    '甘肃-张掖': 'gansu/zhangye',
    '甘肃-平凉': 'gansu/pingliang',
    '甘肃-酒泉': 'gansu/jiuquan',
    '甘肃-庆阳': 'gansu/qingyang',
    '甘肃-定西': 'gansu/dingxi',
    '甘肃-陇南': 'gansu/longnan',
    '甘肃-临夏': 'gansu/linxia',
    '甘肃-甘南': 'gansu/gannan',
    '青海-西宁': 'qinghai/xining',
    '青海-海东': 'qinghai/haidong',
    '青海-海北': 'qinghai/haibei',
    '青海-黄南': 'qinghai/huangnan',
    '青海-海南州': 'qinghai/hailanzhou',
    '青海-果洛': 'qinghai/golog',
    '青海-玉树': 'qinghai/yushu',
    '青海-海西': 'qinghai/haixi',
    '宁夏-银川': 'ningxia/yinchuan',
    '宁夏-石嘴山': 'ningxia/shizuishan',
    '宁夏-吴忠': 'ningxia/wuzhong',
    '宁夏-固原': 'ningxia/guyuan',
    '宁夏-中卫': 'ningxia/zhongwei',
    '新疆-乌鲁木齐': 'xinjiang/wulumuqi',
    '新疆-克拉玛依': 'xinjiang/karamay',
    '新疆-吐鲁番': 'xinjiang/turpan',
    '新疆-哈密': 'xinjiang/hami',
    '新疆-昌吉': 'xinjiang/changji',
    '新疆-博尔塔拉': 'xinjiang/bortala',
    '新疆-巴音郭楞': 'xinjiang/bayingolin',
    '新疆-阿克苏': 'xinjiang/aksu',
    '新疆-克孜勒苏': 'xinjiang/kizilsu',
    '新疆-喀什': 'xinjiang/kaxgar',
    '新疆-和田': 'xinjiang/hotan',
    '新疆-伊犁': 'xinjiang/ili',
    '新疆-塔城': 'xinjiang/tacheng',
    '新疆-阿勒泰': 'xinjiang/altay',
    '西藏-拉萨': 'xizang/lhasa',
    '西藏-昌都': 'xizang/changdu',
    '西藏-山南': 'xizang/shannan',
    '西藏-日喀则': 'xizang/rikeze',
    '西藏-那曲': 'xizang/naqu',
    '西藏-阿里': 'xizang/ali',
    '西藏-林芝': 'xizang/linzhi',
    '内蒙古-呼和浩特': 'neimenggu/huhehaote',
    '内蒙古-包头': 'neimenggu/baotou',
    '内蒙古-乌海': 'neimenggu/wuhai',
    '内蒙古-赤峰': 'neimenggu/chifeng',
    '内蒙古-通辽': 'neimenggu/tongliao',
    '内蒙古-鄂尔多斯': 'neimenggu/ordos',
    '内蒙古-呼伦贝尔': 'neimenggu/hulunbeir',
    '内蒙古-巴彦淖尔': 'neimenggu/bayannaoer',
    '内蒙古-乌兰察布': 'neimenggu/wulanchabu',
    '内蒙古-兴安盟': 'neimenggu/xinganmeng',
    '内蒙古-锡林郭勒': 'neimenggu/xilinguole',
    '内蒙古-阿拉善': 'neimenggu/alashan',
  };
  // OIL_REGION（模块中文填写）优先，兼容旧版 region（拼音）
  // 支持三种填法：城市名（海口）、"省份-城市"（广东-深圳）、拼音（hainan/haikou）
  const CITY_MAP = {};      // 纯城市名 -> 拼音路径
  const PROVINCE_PINYIN = {}; // 省份名 -> 省份拼音
  for (const [k, v] of Object.entries(REGION_MAP)) {
    if (k.includes('-')) {
      const [prov, city] = k.split('-');
      CITY_MAP[city] = v;
      if (!PROVINCE_PINYIN[prov]) PROVINCE_PINYIN[prov] = v.split('/')[0];
    } else {
      CITY_MAP[k] = v;
      PROVINCE_PINYIN[k] = v;
    }
  }
  function resolveRegion(input) {
    input = (input || '').trim();
    if (!input) return 'hainan/haikou';
    if (REGION_MAP[input]) return REGION_MAP[input];
    if (CITY_MAP[input]) return CITY_MAP[input];
    if (PROVINCE_PINYIN[input]) return PROVINCE_PINYIN[input];
    return input; // 旧版拼音直传
  }
  const regionInput = (ctx.env.OIL_REGION || ctx.env.region || '').trim();
  const regionParam = resolveRegion(regionInput);
  const SHOW_TREND = (ctx.env.SHOW_TREND || "true").trim() !== "false";

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const refreshTime = new Date(Date.now() + 6*60*60*1000).toISOString();

  const backgroundColor = { light: "#FFFFFF", dark: "#1C1C1E" };

  const COLORS = {
    primary: { light: "#1A1A1A", dark: "#FFFFFF" },
    secondary: { light: "#666666", dark: "#CCCCCC" },
    tertiary: { light: "#999999", dark: "#888888" },
    card: { light: "#FFFFFF15", dark: "#FFFFFF10" },
    cardBorder: { light: "#00000015", dark: "#FFFFFF20" },
    p92: { light: "#FF9F0A", dark: "#FFB347" },
    p95: { light: "#FF6B35", dark: "#FF8A5C" },
    p98: { light: "#FF3B30", dark: "#FF6B6B" },
    diesel: { light: "#30D158", dark: "#5CD67D" },
    trend: { light: "#2C2C2E", dark: "#FFFFFF" },
  };

  const CACHE_KEY = `qiyoujiage_oil_${regionParam}`;
  let prices = {p92:null, p95:null, p98:null, diesel:null};
  let regionName = "";
  let trendInfo = "";
  let hasCache = false;
  
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached && cached.prices) {
      prices = cached.prices;
      regionName = cached.regionName || "";
      trendInfo = cached.trendInfo || "";
      hasCache = true;
    }
  } catch(_){}

  let fetchError = false;
  let errorMsg = "";

  try {
    const queryAddr = `http://m.qiyoujiage.com/${regionParam}.shtml`;
    
    const resp = await ctx.http.get(queryAddr, {
      headers: {
        'referer': 'http://m.qiyoujiage.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });
    
    if (resp.status !== 200) {
      throw new Error(`HTTP ${resp.status}: 页面不存在`);
    }
    
    const html = await resp.text();
    const titleMatch = html.match(/<title>([^_]+)_/);
    if (titleMatch && titleMatch[1]) {
      let rawName = titleMatch[1].trim();
      regionName = rawName.replace(/(油价|实时|今日|最新|查询|价格)/g, '').trim();
    }
    const regPrice = /<dl>[\s\S]+?<dt>(.*油)<\/dt>[\s\S]+?<dd>(.*)\(元\)<\/dd>/gm;
    const priceList = [];
    let m = null;
    
    while ((m = regPrice.exec(html)) !== null) {
      if (m.index === regPrice.lastIndex) regPrice.lastIndex++;
      priceList.push({ name: m[1].trim(), value: m[2].trim() });
    }

    if (priceList.length >= 3) {
      const nameMap = { 
        "92 号": "p92", "92": "p92",
        "95 号": "p95", "95": "p95",
        "98 号": "p98", "98": "p98",
        "0 号": "diesel", "柴油": "diesel"
      };
      
      prices = {p92:null, p95:null, p98:null, diesel:null};
      
      priceList.forEach(item => {
        const key = Object.keys(nameMap).find(k => item.name.includes(k));
        if (key) {
          const priceVal = parseFloat(item.value);
          if (!isNaN(priceVal)) {
            prices[nameMap[key]] = priceVal;
          }
        }
      });
      if (SHOW_TREND) {
        const regTrend = /<div class="tishi">[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<br\/>([\s\S]+?)<br\/>/;
        const trendMatch = html.match(regTrend);
        
        if (trendMatch && trendMatch.length >= 3) {
          const datePart = trendMatch[1].split('价')[1]?.slice(0, -2) || "";
          const valuePart = trendMatch[2];
          const trend = (valuePart.includes('下调') || valuePart.includes('下跌')) ? '↓' : '↑';
          let amount = "";
          const allPrices = valuePart.match(/([\d\.]+)\s*元\/升/g);
          if (allPrices && allPrices.length >= 2) {
            const nums = allPrices.map(p => p.match(/([\d\.]+)/)[1]);
            amount = `${nums[0]}-${nums[1]}`;
          }
          else {
            const allTons = valuePart.match(/([\d]+)\s*元(?:\/吨)?/g);
            if (allTons && allTons.length >= 2) {
              const nums = allTons.map(p => p.match(/([\d]+)/)[1]);
              amount = `${nums[0]}-${nums[1]}元/吨`;
            }
            else {
              const singleMatch = valuePart.match(/([\d\.]+)\s*元\/升/);
              if (singleMatch) {
                amount = `${singleMatch[1]}元/L`;
              }
            }
          }
          
          trendInfo = `${datePart}调整 ${trend} ${amount}`.trim();
        }
      }

      // 缓存包含地区名
      ctx.storage.setJSON(CACHE_KEY, { prices, regionName, trendInfo });
      fetchError = false;
    } else {
      if (!hasCache) {
        fetchError = true;
        errorMsg = `解析失败`;
      }
    }

  } catch (e) {
    if (!hasCache) {
      fetchError = true;
      errorMsg = e.message;
    }
  }

  const titleText = regionName ? `${regionName}实时油价` : "实时油价";

  const rows = [
    {label:"92 号", price:prices.p92, color:COLORS.p92},
    {label:"95 号", price:prices.p95, color:COLORS.p95},
    {label:"98 号", price:prices.p98, color:COLORS.p98},
    {label:"柴油", price:prices.diesel, color:COLORS.diesel},
  ].filter(r => r.price !== null);

  function priceCard(row){
    return {
      type:"stack",
      direction:"column",
      alignItems:"center",
      flex:1,
      padding:[8,4,8,4],
      backgroundColor: COLORS.card,
      borderRadius:12,
      borderWidth: 0.5,
      borderColor: COLORS.cardBorder,
      children:[
        {
          type:"stack",
          direction:"row",
          alignItems:"center",
          width:44,
          height:22,
          backgroundColor: {
            light: row.color.light + "28",
            dark: row.color.dark + "28"
          },
          borderRadius:6,
          borderWidth:0.5,
          borderColor: {
            light: row.color.light + "55",
            dark: row.color.dark + "55"
          },
          children:[{
            type:"text",
            text:row.label,
            font:{size:"caption2",weight:"bold"},
            textColor: row.color,
            textAlign:"center"
          }]
        },
        {
          type:"text",
          text:row.price !== null ? row.price.toFixed(2) : "--",
          font:{size:"title3",weight:"semibold"},
          textColor: COLORS.primary,
          textAlign:"center",
          maxLines:1,
          minScale:0.7
        }
      ]
    }
  }

  // ═══════════ 锁屏专用布局（仅 accessory 系列生效，其他尺寸不受影响）═══════════
  if (ctx.widgetFamily && ctx.widgetFamily.startsWith("accessory")) {
    // 锁屏背景透明，文字颜色交给系统处理，次要文字用半透明白色
    const SUB = { light: "#FFFFFFB3", dark: "#FFFFFFB3" };
    const short = (label) => label.replace(/\s/g, "");   // "92 号" → "92号"
    const place = regionName || "油价";

    let lockDate = "";
    const ldm = trendInfo.match(/(\d{1,2})月(\d{1,2})日/);
    if (SHOW_TREND && ldm) {
      lockDate = `${ldm[1].padStart(2,"0")}-${ldm[2].padStart(2,"0")}`;
    }

    // 没有任何价格数据
    if (rows.length === 0) {
      return {
        type:"widget",
        refreshAfter:refreshTime,
        children:[{
          type:"text",
          text: fetchError ? `油价 ${errorMsg}` : "暂无油价数据",
          font:{size:"caption1",weight:"medium"},
          maxLines:1,
          minScale:0.5
        }]
      };
    }

    // 单行：海口 92号 9.72 · 95号 10.33
    if (ctx.widgetFamily === "accessoryInline") {
      return {
        type:"widget",
        refreshAfter:refreshTime,
        children:[{
          type:"text",
          text:`${place} ${rows.slice(0, 2).map(r => `${short(r.label)} ${r.price.toFixed(2)}`).join(" · ")}`,
          font:{size:"caption1",weight:"medium"},
          maxLines:1,
          minScale:0.5
        }]
      };
    }

    // 圆形：只显示 92 号（没有则显示第一项）
    if (ctx.widgetFamily === "accessoryCircular") {
      const r0 = rows.find(r => r.label.includes("92")) || rows[0];
      return {
        type:"widget",
        padding:2,
        refreshAfter:refreshTime,
        children:[
          {type:"spacer"},
          {type:"text",text:short(r0.label),font:{size:"caption2",weight:"medium"},textColor:SUB,textAlign:"center",maxLines:1},
          {type:"text",text:r0.price.toFixed(2),font:{size:"headline",weight:"bold"},textAlign:"center",maxLines:1,minScale:0.5},
          {type:"text",text:"元/升",font:{size:"caption2"},textColor:SUB,textAlign:"center",maxLines:1},
          {type:"spacer"}
        ]
      };
    }

    // 矩形：第一行地区 + 调价日期，下面两行每行两个油品（左边说明，右边加粗价格）
    const cell = (r) => ({
      type:"stack",
      direction:"row",
      alignItems:"center",
      flex:1,
      gap:4,
      children:[
        {type:"text",text:short(r.label),font:{size:"caption2",weight:"medium"},textColor:SUB,maxLines:1},
        {type:"spacer"},
        {type:"text",text:r.price.toFixed(2),font:{size:"caption1",weight:"bold"},maxLines:1,minScale:0.6}
      ]
    });

    const lockPairs = [];
    for (let i = 0; i < rows.length; i += 2) lockPairs.push(rows.slice(i, i + 2));

    return {
      type:"widget",
      padding:2,
      gap:3,
      refreshAfter:refreshTime,
      children:[
        {
          type:"stack",
          direction:"row",
          alignItems:"center",
          gap:4,
          children:[
            {type:"image",src:"sf-symbol:fuelpump.fill",width:11,height:11},
            {type:"text",text:place,font:{size:"caption2",weight:"semibold"},maxLines:1,minScale:0.7},
            {type:"spacer"},
            ...(lockDate ? [{type:"text",text:lockDate,font:{size:"caption2"},textColor:SUB,maxLines:1}] : [])
          ]
        },
        ...lockPairs.map(pair => ({
          type:"stack",
          direction:"row",
          alignItems:"center",
          gap:10,
          children: pair.length === 1 ? [cell(pair[0]), {type:"spacer"}] : pair.map(cell)
        }))
      ]
    };
  }
  // ═══════════ 锁屏专用布局结束 ═══════════

  if (ctx.widgetFamily === "systemSmall") {
    const smallCard = (row) => ({
      type:"stack",
      direction:"column",
      alignItems:"center",
      flex:1,
      gap:0,
      padding:[2,4,2,4],
      backgroundColor: COLORS.card,
      borderRadius:10,
      borderWidth:0.5,
      borderColor: COLORS.cardBorder,
      children:[
        {
          type:"stack",
          direction:"row",
          alignItems:"center",
          padding:[1,8,1,8],
          backgroundColor: {
            light: row.color.light + "28",
            dark: row.color.dark + "28"
          },
          borderRadius:6,
          children:[{
            type:"text",
            text:row.label,
            font:{size:"caption2",weight:"bold"},
            textColor: row.color,
            textAlign:"center"
          }]
        },
        {
          type:"text",
          text:row.price.toFixed(2),
          font:{size:"headline",weight:"bold"},
          textColor: COLORS.primary,
          textAlign:"center",
          maxLines:1,
          minScale:0.7
        }
      ]
    });
    const pairs = [];
    for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));

    return {
      type:"widget",
      padding:[10,10,10,10],
      gap:2,
      refreshAfter:refreshTime,
      children:[
        {
          type:"stack",
          direction:"row",
          alignItems:"center",
          gap:4,
          children:[
            {type:"image",src:"sf-symbol:fuelpump.fill",width:16,height:16,color:COLORS.p92},
            {type:"text",text:`${regionName || ""}油价`,font:{size:"headline",weight:"bold"},textColor:COLORS.primary,maxLines:1,minScale:0.7},
            {type:"spacer"},
            {type:"image",src:"sf-symbol:arrow.clockwise",width:12,height:12,color:COLORS.tertiary},
            {type:"text",text:timeStr,font:{size:"callout"},textColor:COLORS.tertiary,maxLines:1}
          ]
        },
        ...(SHOW_TREND && trendInfo ? [{
          type:"text",
          text:trendInfo.replace(/\s+/g, ""),
          font:{size:"caption1"},
          textColor:COLORS.secondary,
          maxLines:1,
          minScale:0.5
        }] : []),
        ...(fetchError ? [{
          type:"text",
          text:errorMsg,
          font:{size:"caption2"},
          textColor:COLORS.p98,
          maxLines:1,
          minScale:0.6
        }] : []),
        rows.length > 0 ? {
          type:"stack",
          direction:"column",
          flex:1,
          gap:4,
          children: pairs.map(pair => ({
            type:"stack",
            direction:"row",
            gap:6,
            children: pair.map(smallCard)
          }))
        } : {
          type:"stack",
          direction:"column",
          alignItems:"center",
          flex:1,
          gap:4,
          children:[
            {type:"image",src:"sf-symbol:exclamationmark.triangle.fill",width:20,height:20,color:COLORS.p98},
            {type:"text",text:fetchError?"数据获取失败":"暂无数据",font:{size:"caption2"},textColor:COLORS.secondary}
          ]
        }
      ]
    };
  }

  return {
    type:"widget",
    padding:[10,8,10,8],
    gap:5,
    
    refreshAfter:refreshTime,
    children:[
      {
        type:"stack",
        direction:"row",
        alignItems:"center",
        gap:4,
        padding:[0,4,0,4],
        children:[
          {type:"image",src:"sf-symbol:fuelpump.fill",width:13,height:13,color:COLORS.p92},
          {type:"text",text:titleText,font:{size:"caption2",weight:"semibold"},textColor:COLORS.secondary},
          {type:"spacer"},
          ...(SHOW_TREND && trendInfo ? [{
            type:"text",
            text: trendInfo,
            font:{size:"caption2"},
            textColor: COLORS.trend,
            textAlign:"right",
            maxLines:1,
            minScale: 0.8
          }] : []),
          ...(fetchError ? [{
            type:"text",text:errorMsg,font:{size:"caption2"},textColor:COLORS.p98
          }] : [])
        ].filter(Boolean)
      },
      rows.length > 0 ? {
        type:"stack",
        direction:"row",
        alignItems:"center",
        gap:6,
        padding:[6,0,6,0],
        children: rows.map(priceCard)
      } : {
        type:"stack",
        direction:"column",
        alignItems:"center",
        padding:[20,10,20,10],
        children:[
          {type:"image",src:"sf-symbol:exclamationmark.triangle.fill",width:24,height:24,color:COLORS.p98},
          {type:"text",text:fetchError?"数据获取失败":"暂无数据",font:{size:"body"},textColor:COLORS.secondary}
        ]
      },
      {
        type:"stack",
        direction:"row",
        alignItems:"center",
        padding:[0,4,0,4],
        children:[
          {type:"text",text:`${timeStr} 更新`,font:{size:"caption2"},textColor:COLORS.tertiary},
          {type:"spacer"},
          {type:"text",text:"元/升",font:{size:"caption2"},textColor:COLORS.tertiary}
        ]
      }
    ]
  }
}
