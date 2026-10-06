import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

const ORDER_SNIPPET = `console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");`;

const DUPLICATE_SNIPPET = `function hasDuplicate(ids: string[]): boolean {
  for (let i = 0; i < ids.length; i++) {
    if (ids.indexOf(ids[i]) !== i) return true;
  }
  return false;
}`;

const BUG_SNIPPET = `type Reading = { at: string; value: number };

// Readings arrive sorted oldest first. Returns the average of the last 5
// readings (or of all of them if there are fewer) and the newest reading's time.
function recentAverage(readings: Reading[]): { average: number; newestAt: string } {
  const start = Math.max(0, readings.length - 5);
  let total = 0;
  for (let i = start; i <= readings.length; i++) {
    total += readings[i].value;
  }
  const count = readings.length - start;
  return {
    average: total / count,
    newestAt: readings[readings.length - 1].at,
  };
}`;

const REVIEW_DIFF = `// src/orders/routes.ts
 router.get("/orders", async (req, res) => {
-  const orders = await db.query("SELECT * FROM orders WHERE customer_id = $1", [req.user.id]);
+  const status = req.query.status as string;
+  const orders = await db.query(
+    "SELECT * FROM orders WHERE customer_id = $1 AND status = '" + status + "'",
+    [req.user.id],
+  );
+  orders.rows.forEach(async (o) => {
+    o.items = (await db.query("SELECT * FROM order_items WHERE order_id = $1", [o.id])).rows;
+  });
   res.json(orders.rows);
 });`;

export const softwareDeveloper: HiringTemplate = {
  key: "software-developer",
  group: "GENERIC",
  name: t("Yazılım Geliştirici", "Software Developer"),
  summary: t("Zor bir hata, TypeScript okuma, hata düzeltme ve kod incelemesi.", "A hard bug, reading TypeScript, fixing a bug and reviewing code."),
  jobAd: t(
    "Ürünümüzün TypeScript ile yazılmış arka ve ön yüzünde yeni özellikler geliştirecek, hataları kök nedenine kadar izleyecek ve ekip arkadaşlarının kodunu inceleyecek bir Yazılım Geliştirici arıyoruz. Kodu okuyarak neyin bozulacağını görebilen, hatayı tahminle değil kanıtla daraltan ve incelemede kibar ama net yorum yazan biri olmalısın.",
    "We are looking for a Software Developer who builds features across our TypeScript back end and front end, traces bugs to their root cause and reviews teammates' code. You can read code and see what will break, narrow a bug down with evidence rather than guesses, and write review comments that are kind but clear.",
  ),
  weights: { technical: 40, problem_solving: 35, teamwork: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t(
        "İki kısa kod okuma sorusu ve iki video sorusu. En fazla 14 dakika.",
        "Two short code-reading questions and two video questions. At most 14 minutes.",
      ),
      purpose: "Olay döngüsü ve zaman karmaşıklığı bilgisi; gerçek bir zor hatada hata ayıklama yöntemi; teknik anlaşmazlıkta ekip içi davranış.",
      minutes: 14,
      activities: [
        single({
          prompt: t(
            `Aşağıdaki TypeScript kodu Node.js'te çalıştırılıyor. Harfler ekrana hangi sırayla yazılır?\n\n${ORDER_SNIPPET}`,
            `The TypeScript code below runs in Node.js. In what order are the letters printed?\n\n${ORDER_SNIPPET}`,
          ),
          options: [t("A, B, C, D", "A, B, C, D"), t("A, D, B, C", "A, D, B, C"), t("A, D, C, B", "A, D, C, B"), t("A, C, D, B", "A, C, D, B")],
          correct: 2,
          internal:
            "Doğru cevap: A, D, C, B. Senkron kod önce biter (A, D); ardından mikro görev kuyruğu (Promise.then, C), en son makro görev (setTimeout 0, B). Çeldiriciler: A, B, C, D (her şeyi senkron sanmak), A, D, B, C (setTimeout 0'ın Promise'ten önce çalıştığını sanmak), A, C, D, B (then geri çağrısının hemen çalıştığını sanmak). Node ile doğrulandı.",
        }),
        single({
          prompt: t(
            `Aşağıdaki fonksiyonun, n = ids.length iken, en kötü durumdaki (hiç tekrar yokken) zaman karmaşıklığı nedir?\n\n${DUPLICATE_SNIPPET}`,
            `What is the worst-case time complexity of the function below (no duplicates at all), with n = ids.length?\n\n${DUPLICATE_SNIPPET}`,
          ),
          options: [
            t("O(n): döngü dizi üzerinde yalnızca bir kez döner", "O(n): the loop runs over the array only once"),
            t("O(n): indexOf aramayı en geç i. elemanda bitirir", "O(n): indexOf stops searching at element i at the latest"),
            t("O(n log n): indexOf her adımda ikili aramayla arar", "O(n log n): indexOf uses a binary search at every step"),
            t("O(n²): indexOf her adımda dizinin başından i'ye kadar tarar", "O(n²): indexOf scans from the start up to i at every step"),
          ],
          correct: 3,
          internal:
            "Doğru cevap: O(n²). Döngü n kez döner, her adımda indexOf diziyi baştan i'ye kadar tarar (sıralanmamış dizide doğrusal arama), toplam yaklaşık n²/2 karşılaştırma. Çeldiriciler: O(n), tek döngü (indexOf'un maliyetini görmemek, en sık hata); O(n), indexOf i'de durur (aramanın i'de bittiğini görüp toplamın 0+1+...+(n-1) = n(n-1)/2 olduğunu kaçırmak); O(n log n) (indexOf'u ikili arama sanmak; dizi sıralı değil). Daha iyi çözüm: Set ile O(n).",
        }),
        video({
          prompt: t(
            "Çözmesi en zor olan bir hatayı (bug) anlat: belirtisi neydi, nedeni nasıl daralttın, kök neden neydi, nasıl düzelttin ve aynı hatanın tekrar olmaması için sonra neyi değiştirdin?",
            "Tell us about the hardest bug you have debugged: what was the symptom, how did you narrow down the cause, what was the root cause, how did you fix it, and what did you change afterwards so the same bug would not come back?",
          ),
          competencies: ["problem_solving", "technical"],
          expected: [
            "Belirtiyi ve ortamı somut anlatıyor (hangi sistem, ne zaman, kimin gördüğü, hata mesajı ya da ölçüm)",
            "Nedeni kanıtla daralttığını anlatıyor: hatayı tekrar üretme, log, hata ayıklayıcı, ikiye bölme (bisect) gibi bir yöntem ve elenen varsayımlar",
            "Belirti ile kök nedeni ayırıyor ve kök nedeni teknik olarak doğru açıklıyor",
            "Sonradan eklediği bir önlemi söylüyor (test, izleme, tip, kod incelemesi kuralı)",
          ],
          redFlags: ["Rastgele değişiklik yaparak hatanın kendiliğinden kaybolduğunu anlatıyor", "Kök nedeni söyleyemiyor ya da yalnızca belirtiyi düzeltiyor", "Somut bir hata yerine genel bir süreç anlatıyor"],
          examples: {
            1: "Bir ekranda veri bazen gelmiyordu. Birkaç yeri değiştirdim, sayfayı yeniden başlattık, sonra düzeldi. Ne olduğunu tam bilmiyoruz ama bir daha olmadı.",
            3: "Ödeme sayfasında bazı siparişler iki kez oluşuyordu. Loglardan aynı isteğin iki kez geldiğini gördüm, butona iki kez tıklanınca oluyordu. Butonu ilk tıklamadan sonra devre dışı bıraktım ve sorun bitti.",
            5: "Sipariş servisinde günde birkaç kez çift kayıt oluşuyordu. Önce loglardan iki isteğin aynı kimlikle 200 ms arayla geldiğini gördüm, sonra yük altında tekrar ürettim. Buton yalnızca belirtiydi; asıl neden ağ hatasında istemcinin isteği tekrar göndermesi ve sunucunun bunu ayırt edememesiydi. İsteğe idempotency anahtarı ekleyip veritabanında benzersiz kısıt koydum, eşzamanlı istek testi yazdım ve çift kayıt sayısını izleyen bir alarm kurdum.",
          },
        }),
        video({
          prompt: t(
            "Bir teknik kararda (kod incelemesi, tasarım, kütüphane seçimi gibi) bir ekip arkadaşınla anlaşamadığın bir durumu anlat: konu neydi, sen tam olarak ne söyledin ve ne yaptın, nasıl karar verildi ve sonuç ne oldu?",
            "Tell us about a time you disagreed with a teammate on a technical decision (such as a code review, a design or a library choice): what was it about, what exactly did you say and do, how was it decided, and what was the result?",
          ),
          competencies: ["teamwork"],
          expected: [
            "İki tarafın görüşünü de adil ve somut anlatıyor, arkadaşının haklı olduğu noktayı kabul ediyor",
            "Anlaşmazlığı veriyle ya da denemeyle çözdüğünü anlatıyor (ölçüm, prototip, kısa bir karşılaştırma)",
            "Kararın nasıl alındığını ve sonra ortak kararı nasıl sahiplendiğini söylüyor, kendi fikrinden vazgeçtiyse bunu açıkça anlatıyor",
          ],
          redFlags: ["Arkadaşını küçümsüyor ya da yetersiz gösteriyor", "Tartışmadan kaçtığını ya da kararı yöneticiye bırakıp çekildiğini anlatıyor", "Kendi fikrini kabul ettirene kadar ısrar etmeyi başarı sayıyor"],
          examples: {
            1: "Arkadaşım ORM kullanmak istiyordu, ben istemiyordum. Sonunda ben haklı çıktım çünkü daha deneyimliyim, o da kabul etti.",
            3: "Kod incelemesinde arkadaşım her şeyi tek bir servise koymak istedi, ben ayırmayı önerdim. Toplantıda iki tarafı konuştuk, onun daha hızlı teslim etme kaygısını anladım ve önce tek servisle başlayıp sonra ayırmaya karar verdik.",
            5: "Selin önbellek için Redis eklemek istedi, ben sorgunun kendisinin yavaş olduğunu düşünüyordum. Tartışmayı uzatmak yerine ikimiz birer saat ayırıp ölçtük: indeks eklemek süreyi 900 ms'den 120 ms'ye indirdi, önbellek ise 40 ms veriyordu ama tutarlılık riski getiriyordu. Önce indeksle gitmeye, yükün artacağı kampanya döneminde önbelleği eklemeye birlikte karar verdik. Selin'in yük tahmini benimkinden doğru çıktı, kampanyada önbelleği ben kurdum.",
          },
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t(
        "Gerçek işe benzeyen iki yazılı görev: bir hatayı bulup düzeltmek ve bir kod değişikliğini incelemek. En fazla 20 dakika.",
        "Two written tasks like the real job: finding and fixing a bug, and reviewing a code change. At most 20 minutes.",
      ),
      purpose: "Kodu okuyarak hatayı ve kenar durumu bulma, düzeltmeyi gerekçelendirme; kod incelemesinde güvenlik, doğruluk ve performans sorunlarını kibar ve net bir dille yazma.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            `Aşağıdaki TypeScript fonksiyonu testte hata veriyor. Kodu incele: hatalı olan her şeyi bul, her birinin hangi girdide ortaya çıktığını ve neden olduğunu açıkla, sonra düzeltilmiş fonksiyonu yaz.\n\n${BUG_SNIPPET}`,
            `The TypeScript function below fails in tests. Review it: find everything that is wrong, explain for each problem which input triggers it and why, then write the corrected function.\n\n${BUG_SNIPPET}`,
          ),
          competencies: ["technical", "problem_solving"],
          expected: [
            "Döngü koşulundaki i <= readings.length hatasını buluyor: son adımda readings[readings.length] undefined olur ve .value okunurken her çağrıda hata fırlatır; koşulu i < readings.length yapıyor",
            "Boş liste durumunu buluyor: count 0 olur, ortalama NaN çıkar ve readings[-1] undefined olduğu için .at okunurken hata fırlatır",
            "Boş liste için bilinçli bir davranış seçip gerekçelendiriyor (null döndürmek ve dönüş tipini güncellemek ya da anlamlı bir hata fırlatmak) ve çağıran tarafın etkisini söylüyor",
            "Düzeltmeyi örnek girdilerle sınıyor ya da test önerisi yazıyor (0, 3 ve 7 okuma gibi)",
          ],
          redFlags: ["Yalnızca döngü hatasını düzeltip boş liste durumunu görmüyor", "Hatanın nedenini açıklamadan kodu baştan yazıyor", "Var olmayan bir hata uydurup doğru çalışan bir satırı değiştiriyor (Math.max ya da count hesabı gibi)"],
          examples: {
            1: "Kod biraz karışık. reduce ile yeniden yazarım: const average = readings.reduce((a, r) => a + r.value, 0) / readings.length. Böylece daha temiz olur.",
            3: "Döngüde i <= readings.length yazılmış, son turda readings[length] undefined olduğu için .value hata verir. i < readings.length olmalı. Düzeltilmiş fonksiyon: (döngü koşulu düzeltilmiş kod).",
            5: "İki sorun var. (1) Döngü i <= readings.length: son turda readings[length] undefined, her çağrıda TypeError. Koşul i < readings.length olmalı. (2) Boş liste: start 0, count 0, ortalama 0/0 = NaN ve readings[-1].at TypeError fırlatır. Tip sistemi bunu yakalamaz çünkü dizi indeksi undefined dönebilir sayılmıyor. Dönüş tipini ... | null yapıp başta if (readings.length === 0) return null; ekliyorum, çağıranlar null durumunu ele almalı. Sınama: 0 okuma null, 3 okuma (1,2,3) ortalama 2, 7 okuma (1..7) ortalama 5.",
          },
          internal:
            "Yerleştirilmiş hatalar (tam olarak 2):\n1) Belirgin (off-by-one): for koşulu i <= readings.length. Son turda readings[readings.length] undefined olur, .value okunurken her çağrıda TypeError. Düzeltme: i < readings.length.\n2) İnce (boş liste): readings boşsa start = 0, count = 0, ortalama 0/0 = NaN ve readings[-1] undefined, .at TypeError. strict TypeScript bunu yakalamaz (noUncheckedIndexedAccess kapalı). Düzeltme: başta boş liste kontrolü, null döndürüp dönüş tipini güncellemek ya da açık bir hata fırlatmak.\nDiğer satırlar doğru: Math.max(0, length - 5) ve count = length - start doğru. Kontrol (Node ile doğrulandı): 1..7 değerli 7 okuma için ortalama 5, 1..3 değerli 3 okuma için 2.",
        }),
        longText({
          prompt: t(
            `Takıma iki ay önce katılan Ece aşağıdaki değişikliği açtı. Açıklaması: "Siparişler durumuna göre filtrelenebilsin ve her siparişin kalemleri cevapta gelsin." db.query, node-postgres gibi parametreli sorgu destekleyen bir istemci; sonucu { rows } olarak döner.\n\nEce'ye yazacağın kod incelemesi yorumlarını, PR'a yazacağın gibi yaz: her sorun için ne olduğunu, neden sorun olduğunu ve nasıl düzeltilebileceğini söyle.\n\n${REVIEW_DIFF}`,
            `Ece, who joined the team two months ago, opened the change below. Its description: "Orders can be filtered by status and each order's items come back in the response." db.query is a client like node-postgres that supports parameterised queries and returns { rows }.\n\nWrite your code review comments to Ece as you would post them on the PR: for each problem say what it is, why it is a problem and how it could be fixed.\n\n${REVIEW_DIFF}`,
          ),
          competencies: ["technical", "teamwork"],
          expected: [
            "SQL enjeksiyonunu buluyor: status sorguya metin olarak ekleniyor; $2 parametresiyle göndermeyi öneriyor ve bunu birleştirmeyi engelleyen (blocking) sorun olarak işaretliyor",
            "forEach(async ...) sorununu buluyor: forEach Promise'leri beklemez, res.json kalemler yüklenmeden gider; for...of ile await ya da Promise.all öneriyor",
            "En az bir ince sorunu daha buluyor: her sipariş için ayrı sorgu (N+1), tek sorguda ANY($1) ya da JOIN öneriyor; status gelmezse sorgu status = 'undefined' arar ve hiç sipariş dönmez, filtreyi isteğe bağlı yapmayı öneriyor",
            "Yorumları kişiye değil koda yönelik, nedeniyle ve kibar yazıyor; engelleyen ile öneri niteliğindeki yorumu ayırıyor ve iyi olan bir şeyi de söylüyor",
          ],
          redFlags: ["SQL enjeksiyonunu görmüyor", "Yalnızca 'olmamış, düzelt' gibi gerekçesiz ya da kişiyi küçümseyen yorumlar yazıyor", "Biçim ve adlandırma gibi küçük konularda kalıp asıl hataları kaçırıyor"],
          examples: {
            1: "Bu kod pek iyi değil, daha dikkatli olmalısın. forEach yerine map kullan ve değişken adlarını düzelt. Onaylamıyorum.",
            3: "Engelleyen: status sorguya metin olarak eklenmiş, bu SQL enjeksiyonuna açık. Parametre olarak ($2) gönderelim. Ayrıca forEach async fonksiyonları beklemiyor, res.json kalemler gelmeden gidiyor; for...of ile await kullanabiliriz. Filtre fikri güzel, eline sağlık.",
            5: "Eline sağlık, filtre ihtiyacı yerinde. Engelleyen 1: status metne ekleniyor, ?status=' OR '1'='1 gibi bir değer tüm müşterilerin siparişlerini döndürür; status = $2 ile parametre yapalım. Engelleyen 2: forEach Promise'leri beklemez, res.json kalemler dolmadan gider. Engelleyen 3: status gelmezse sorgu status = 'undefined' arar ve liste boş döner; filtre isteğe bağlı olsun. Öneri: her sipariş için ayrı sorgu N+1 yaratıyor; tüm kalemleri order_id = ANY($1) ile tek sorguda alıp eşleyebiliriz. Bu durumlar için bir test ekleyelim, istersen birlikte bakalım.",
          },
          internal:
            "Yerleştirilmiş sorunlar (4):\n1) Belirgin, engelleyen: status metin birleştirmeyle sorguya giriyor, SQL enjeksiyonu. Düzeltme: AND status = $2, [req.user.id, status].\n2) İnce, engelleyen: orders.rows.forEach(async ...) Promise'leri beklemez; res.json kalemler atanmadan çalışır, items cevapta yok. Düzeltme: Promise.all(rows.map(...)) ya da for...of + await.\n3) İnce: status gönderilmezse değer undefined, sorgu status = 'undefined' arar ve hiç sipariş dönmez; eskiden çalışan uç nokta bozulur. Düzeltme: status yoksa filtreyi koyma.\n4) İnce, performans: her sipariş için ayrı sorgu (N+1). Düzeltme: order_id = ANY($1) ile tek sorgu ya da JOIN.\nTon (teamwork): koda yönelik, gerekçeli, engelleyen ve öneri ayrımı, iyi olanı söyleme, yardım teklifi.",
        }),
      ],
    }),
  ],
};
