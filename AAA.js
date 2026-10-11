name: 中国电信小组件
description: 中国电信 话费 语音 流量小组件。打开电信 App 自动抓取登录凭证（无密码）；抓不到时可手动填 token 等
author: iBL3ND
icon: https://iili.io/nEufFXR.png
compat_arguments:
  ctAppCapture: 'true'
  ctToken: ''
  ctUserId: ''
  ctPhone: ''
  ctProvinceCode: ''
  ctCityCode: ''
  ctGeneralFlow: 'true'
  ctDirectionalFlow: 'true'
compat_arguments_schema:
  ctAppCapture:
    name: 中国电信 App 自动抓取
    description: 打开电信 App 时自动抓取登录凭证（推荐开启）
    default_value: 'true'
    options:
    - 'true'
    - 'false'
  ctToken:
    name: token（抓包）
    description: 抓包 headerInfos 里的 token，填完整（模块界面明文显示）
    default_value: ''
  ctUserId:
    name: userId（抓包）
    description: 抓包 content.fieldData 里的 userId
    default_value: ''
  ctPhone:
    name: 手机号
    description: 本机电信手机号（11 位数字）
    default_value: ''
  ctProvinceCode:
    name: provinceCode（抓包）
    description: 抓包里的 provinceCode，如 600403
    default_value: ''
  ctCityCode:
    name: cityCode（抓包）
    description: 抓包里的 cityCode，如 8460100
    default_value: ''
  ctGeneralFlow:
    name: 显示通用流量
    description: 小组件流量统计包含通用流量（关闭则只统计定向流量）
    default_value: 'true'
    options:
    - 'true'
    - 'false'
  ctDirectionalFlow:
    name: 显示定向流量
    description: 小组件流量统计包含定向流量（关闭则只统计通用流量）
    default_value: 'true'
    options:
    - 'true'
    - 'false'
dns: {}
scriptings:
- generic:
    name: china-telecom
    script_url: https://raw.githubusercontent.com/IBL3ND/module/refs/heads/main/AAA.js
    env:
      CT_SHOW_GENERAL_FLOW: '{{{ctGeneralFlow}}}'
      CT_SHOW_DIRECTIONAL_FLOW: '{{{ctDirectionalFlow}}}'
      CT_TOKEN: '{{{ctToken}}}'
      CT_USER_ID: '{{{ctUserId}}}'
      CT_PHONE: '{{{ctPhone}}}'
      CT_PROVINCE_CODE: '{{{ctProvinceCode}}}'
      CT_CITY_CODE: '{{{ctCityCode}}}'
- http_request:
    name: 中国电信 App 自动抓取
    match: '^ht[{{{ctAppCapture}}}]ps://appfuwu[sz]*\.189\.cn'
    script_url: https://raw.githubusercontent.com/IBL3ND/module/refs/heads/main/AAA.js
- schedule:
    name: 中国电信保活
    cron: '*/20 * * * *'
    script_url: https://raw.githubusercontent.com/IBL3ND/module/refs/heads/main/AAA.js
mitm:
  hostnames:
    includes:
    - appfuwusz.189.cn
    - appfuwu.189.cn
widgets:
- name: china-telecom
