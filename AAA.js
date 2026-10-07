export default async function (ctx) {
  const data = await ctx.response.json();
  let n = 0;
  if (data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item.cokey === "adconfig") {
        item.covalue = "[]";
        n++;
      }
    }
  }
  ctx.notify({ title: "山丘阅读", body: `已清空推广图 ${n} 项` });
  return { body: data };
}
