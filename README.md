# Habyt – szokáskövető

Piros–fekete szokáskövető app esti check-innel, éves hőtérképpel, havi naptárral és streakekkel.
Telepíthető webapp (PWA): PC-n saját ablakban fut, telefonon a kezdőképernyőre tehető, és net nélkül is működik.

**Élő oldal:** https://habyt-sooty.vercel.app

## Funkciók

- **Ma**: a napi szokások kipipálása, haladásjelző, „tökéletes nap” ünneplés. Nyilakkal a korábbi napok is pótolhatók.
- **Szokások**: saját szokás (név, ikon, kategória, mely napokon), kb. 40 beépített szokás katalógusa, és „Javasolt neked” ajánlások a célod meg a meglévő szokásaid alapján.
- **Statisztika**: tökéletes napok sorozata, az elmúlt év hőtérképe, havi naptár szokásonként (napra kattintva utólag módosítható), sorozatok szokásonként.
- **Beállítások**: esti check-in időpontja (alapból 20:00), értesítés, telepítés, mentés és betöltés fájlból.

## Futtatás a gépen

```
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Utána a böngészőben: http://localhost:8793

## Esti automatikus megnyitás (PC)

Egyszer kell lefuttatni, és onnantól a Windows Feladatütemező minden este 20:00-kor megnyitja az appot:

```
powershell -ExecutionPolicy Bypass -File .\install-reminder.ps1
```

Más időpont vagy cím: `-Time 21:30 -Url "https://.../?checkin=1"`. Ha 20:00-kor ki volt kapcsolva a gép, bekapcsolás után pótolja.
Kikapcsolás: `uninstall-reminder.ps1`.

## Telefonra telepítés

1. Nyisd meg a https://habyt-sooty.vercel.app címet a telefonon.
2. Androidon (Chrome): menü → **Alkalmazás telepítése**. iPhone-on (Safari): Megosztás → **Főképernyőhöz adás**.

## Adatok

Az adatok eszközönként, a böngészőben tárolódnak (localStorage). PC és telefon között a **Beállítások → Mentés fájlba / Betöltés fájlból** gombokkal viheted át őket.

## Tervezett következő lépés

Bejelentkezés és automatikus szinkron a PC és a telefon között (Supabase), valamint 20:00-s push értesítés telefonra (Vercel cron + Web Push).
