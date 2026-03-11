function bytesToGB(bytes){
    return (bytes / 1024 / 1024 / 1024).toFixed(2)
}

function parseHeader(header){

    let upload = 0
    let download = 0
    let total = 0

    let list = header.split(";")

    list.forEach(function(item){

        let parts = item.split("=")

        if(parts.length != 2) return

        let key = parts[0].trim()
        let value = parseInt(parts[1])

        if(key == "upload") upload = value
        if(key == "download") download = value
        if(key == "total") total = value

    })

    return {
        upload,
        download,
        total
    }

}

function getConfig(widget){

    if(widget == "airport_A"){
        return {
            name:$argument["A名称"] || "机场A",
            url:$argument["A地址"],
            reset:$argument["A重置"] || "-"
        }
    }

    if(widget == "airport_B"){
        return {
            name:$argument["B名称"] || "机场B",
            url:$argument["B地址"],
            reset:$argument["B重置"] || "-"
        }
    }

    if(widget == "airport_C"){
        return {
            name:$argument["C名称"] || "机场C",
            url:$argument["C地址"],
            reset:$argument["C重置"] || "-"
        }
    }

}

let widget = $input.widget
let config = getConfig(widget)

if(!config || !config.url){

    $done({
        title:"未配置机场",
        content:"请填写订阅地址"
    })

    return
}

$httpClient.get(config.url,function(err,res,data){

    if(err){

        $done({
            title:config.name,
            content:"获取失败"
        })

        return
    }

    let header = res.headers["subscription-userinfo"]

    if(!header){

        $done({
            title:config.name,
            content:"机场不支持流量查询"
        })

        return
    }

    let info = parseHeader(header)

    let used = info.upload + info.download
    let remain = info.total - used

    let usedGB = bytesToGB(used)
    let totalGB = bytesToGB(info.total)
    let remainGB = bytesToGB(remain)

    let percent = ((used / info.total) * 100).toFixed(0)

    let color = "#30D158"

    if(percent > 80){
        color = "#FF453A"
    }
    else if(percent > 60){
        color = "#FF9F0A"
    }

    $done({
        title:config.name,
        content:
        "剩余 "+remainGB+"GB\n"+
        "已用 "+usedGB+"GB / "+totalGB+"GB\n"+
        "使用 "+percent+"%\n"+
        "重置 "+config.reset+"日",
        icon:"antenna.radiowaves.left.and.right",
        "icon-color":color
    })

})
