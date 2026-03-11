function bytesToGB(bytes){
  return (bytes/1024/1024/1024).toFixed(2)
}

let airport = $input.arguments.airport

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

if(!url){
 $done({
  entries:[
   {
    title:name||"机场",
    content:"未填写订阅地址"
   }
  ]
 })
 return
}

$httpClient.get(url,function(err,res,data){

 if(err){
  $done({
   entries:[
    {
     title:name,
     content:"获取失败"
    }
   ]
  })
  return
 }

 let header =
 res.headers["subscription-userinfo"] ||
 res.headers["Subscription-Userinfo"]

 if(!header){
  $done({
   entries:[
    {
     title:name,
     content:"未检测到流量信息"
    }
   ]
  })
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

 $done({
  entries:[
   {
    title:name,
    content:"剩余 "+remainGB+"GB"
   },
   {
    title:"已用",
    content:usedGB+"GB / "+totalGB+"GB"
   },
   {
    title:"使用率",
    content:percent+"%"
   },
   {
    title:"重置日",
    content:reset+"日"
   }
  ]
 })

})