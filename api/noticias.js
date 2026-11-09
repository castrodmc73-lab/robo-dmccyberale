export default async function handler(req, res) {
  const chave = process.env.GNEWS_API_KEY;
  const categorias = { Mundo: "world", "Economia Global": "business", "Ciência e Tecnologia": "technology", "Clima e Meio Ambiente": "science", Cultura: "entertainment" };
  try {
    const resultados = await Promise.all(Object.entries(categorias).map(async ([nome, topico]) => {
      const url = `https://gnews.io/api/v4/top-headlines?category=${topico}&lang=pt&max=3&apikey=${chave}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Falha na API");
      const dados = await r.json();
      return (dados.articles || []).map((a, i) => ({ id: `${topico}-${i}`, categoria: nome, titulo: a.title, resumo: a.description || "", local: a.source?.name || "FONTE", url: a.url, publicadoEm: a.publishedAt, paragrafos: [a.content || a.description || ""] }));
    }));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(resultados.flat());
  } catch (erro) {
    res.status(502).json({ erro: "Não foi possível obter as notícias." });
  }
}
