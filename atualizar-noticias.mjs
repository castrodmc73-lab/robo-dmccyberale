import { writeFile } from "node:fs/promises";

const FONTES = [
  { categoria: "Brasil", fonte: "G1", url: "https://g1.globo.com/rss/g1/" },
  { categoria: "Brasil", fonte: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml" },
  { categoria: "Estados Unidos", fonte: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml" },
  { categoria: "Estados Unidos", fonte: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
  { categoria: "Internacional", fonte: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { categoria: "Internacional", fonte: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { categoria: "Internacional", fonte: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { categoria: "Internacional", fonte: "DW Brasil", url: "https://rss.dw.com/rdf/rss-br-all" },
  { categoria: "Canadá", fonte: "CBC News", url: "https://www.cbc.ca/cmlink/rss-topstories" },
  { categoria: "Economia", fonte: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { categoria: "Economia", fonte: "The Guardian", url: "https://www.theguardian.com/business/rss" },
  { categoria: "Tecnologia", fonte: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { categoria: "Tecnologia", fonte: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { categoria: "Ciência", fonte: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml" },
  { categoria: "Clima", fonte: "The Guardian", url: "https://www.theguardian.com/environment/rss" },
  { categoria: "Cultura", fonte: "The Guardian", url: "https://www.theguardian.com/culture/rss" },
  { categoria: "Opinião", fonte: "The Guardian", url: "https://www.theguardian.com/commentisfree/rss" }
];

function pegar(bloco, nome) {
  const m = bloco.match(new RegExp("<" + nome + "[^>]*>([\\s\\S]*?)</" + nome + ">", "i"));
  return m ? m[1] : "";
}

function atributo(bloco, nome, attr) {
  const m = bloco.match(new RegExp("<" + nome + "[^>]*\\s" + attr + "=[\"']([^\"']+)[\"']", "i"));
  return m ? m[1] : "";
}

function limpar(texto) {
  return texto
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function imagemDoBloco(bloco) {
  const candidatas = [
    atributo(bloco, "media:content", "url"),
    atributo(bloco, "media:thumbnail", "url"),
    atributo(bloco, "enclosure", "url"),
    (bloco.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1]
  ];

  for (const c of candidatas) {
    if (c && /^https?:\/\//i.test(c.replace(/&amp;/g, "&"))) {
      return c.replace(/&amp;/g, "&").replace(/^http:\/\//i, "https://");
    }
  }
  return null;
}

function lerItens(xml) {
  let blocos = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  if (blocos.length === 0) blocos = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];

  return blocos.slice(0, 12).map(function (bloco) {
    const link = pegar(bloco, "link") || atributo(bloco, "link", "href");
    const resumo = pegar(bloco, "description") || pegar(bloco, "summary") ||
                   pegar(bloco, "content:encoded") || pegar(bloco, "content");

    return {
      titulo: limpar(pegar(bloco, "title")).slice(0, 180),
      resumo: limpar(resumo).slice(0, 340),
      link: limpar(link),
      imagem: imagemDoBloco(bloco),
      data: limpar(pegar(bloco, "pubDate") || pegar(bloco, "published") ||
                   pegar(bloco, "updated") || pegar(bloco, "dc:date"))
    };
  });
}

async function buscarFonte(f) {
  try {
    const resposta = await fetch(f.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DMCCYBERALE/1.0)" },
      signal: AbortSignal.timeout(15000)
    });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);

    const xml = await resposta.text();

    return lerItens(xml).map(function (n) {
      const data = new Date(n.data);
      return {
        categoria: f.categoria,
        fonte: f.fonte,
        ...n,
        data: Number.isNaN(data.getTime()) ? null : data.toISOString()
      };
    });
  } catch (erro) {
    console.warn("Falha em " + f.fonte + ": " + erro.message);
    return [];
  }
}

const resultados = await Promise.all(FONTES.map(buscarFonte));

const vistos = new Set();
const noticias = resultados
  .flat()
  .filter(function (n) {
    if (!n.titulo || !/^https?:\/\//i.test(n.link)) return false;
    if (vistos.has(n.link)) return false;
    vistos.add(n.link);
    return true;
  })
  .sort(function (a, b) {
    return new Date(b.data || 0) - new Date(a.data || 0);
  })
  .slice(0, 150);

if (noticias.length === 0) {
  console.error("Nenhuma notícia obtida. O arquivo anterior foi mantido.");
  process.exit(0);
}

await writeFile("noticias.json", JSON.stringify(noticias, null, 2), "utf8");
console.log(noticias.length + " notícias salvas em noticias.json");
