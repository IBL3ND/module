export default async function (ctx) {
  const data = await ctx.response.json();
  let changed = false;
  if (data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item.cokey === "PARAV2_SPLASHADS_CONFIG") {
        item.covalue = "";
        changed = true;
      }
    }
  }
  if (changed) {
    ctx.notify({ title: "山丘阅读", body: "已清空开屏广告配置" });
  }
  return { body: data };
}
