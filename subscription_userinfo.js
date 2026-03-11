function bytesToGB(b){
  return (b/1024/1024/1024).toFixed(2)
}

let airport = $arguments.airport

let name=""
let url=""
let reset=""

if(airport=="A"){
 name=$argument["A名称"]
 url=$argument["A地址"]
 reset=$argument["A重置"]
}

if(airport=="B"){
 name=$argument["B名称"]
 url=$argument["B地址"]
 reset=$argument["B重置"]
}

if(airport=="C"){
 name=$argument["C名称"]
 url=$argument["C地址"]
 reset=$argument["C重置"]
}

function render(text){

 return {
  title:name || "机场流量",
  content:text
 }

}

if(!url){

 $done(render("未填写订阅地址"))
 return

}

$httpClient.head(url,function(err,res,data){

 if(err){

  $done(render("请求失败"))
  return

 }

 let header =
  res.headers["subscription-userinfo"] ||
  res.headers["Subscription-Userinfo"]

 if(!header){

  $done(render("未检测到流量"))
  return

 }

 let upload=0
 let download=0
 let total=0

 header.split(";").forEach(function(item){

  let p=item.split("=")

  if(p.length!=2) return

  let k=p[0].trim()
  let v=parseInt(p[1])

  if(k=="upload") upload=v
  if(k=="download") download=v
  if(k=="total") total=v

 })

 let used=upload+download
 let remain=total-used

 let usedGB=bytesToGB(used)
 let totalGB=bytesToGB(total)
 let remainGB=bytesToGB(remain)

 let percent=((used/total)*100).toFixed(0)

 let text =
  "剩余 "+remainGB+"GB\n"+
  "已用 "+usedGB+" / "+totalGB+"GB\n"+
  "使用率 "+percent+"%\n"+
  "重置 "+reset+"日"

 $done(render(text))

})