# Trikot-Auktion – Vercel-Version

> **Update (v2):** Behebt zwei Probleme aus der ersten Fassung:
> 1. **"Zurücksetzen beim Tippen"** im Vorstandsbereich – der Admin-Bereich hat jetzt einen eigenen, geschützten Bearbeitungsstand, der von automatischen Hintergrund-Updates nicht mehr überschrieben werden kann.
> 2. **Langsames Laden** – die Seite holt jetzt alle Gebote in einer einzigen gebündelten Datenbankabfrage statt in 24 einzelnen nacheinander.
>
> Außerdem komplett auf **TypeScript** umgestellt, und der Bild-Upload läuft jetzt über einen eigenen Server-Endpunkt (behebt den CORS-Fehler). Am Design/UI wurde nichts verändert.

Diese Version läuft komplett unabhängig von Claude:
- Kein Login für Bietende nötig
- Bilder werden direkt hochgeladen (kein Hotlink-Problem mehr)
- Eigene Datenbank (Upstash Redis über Vercel) – ein einheitlicher Stand für alle
- Kostenlos im Rahmen der Vercel Free-Tier-Limits

## Schritt 1: Projekt zu GitHub hochladen

1. Erstellt (falls noch nicht vorhanden) einen kostenlosen Account auf [github.com](https://github.com)
2. Erstellt ein neues, leeres Repository (z. B. `trikot-auktion`)
3. Ladet diesen gesamten Ordner (`trikot-vercel`) dort hoch:
   - Einfachste Variante ohne Kommandozeile: auf der GitHub-Repo-Seite auf "Add file" → "Upload files" klicken und alle Dateien/Ordner hierher ziehen

## Schritt 2: Bei Vercel importieren

1. Account auf [vercel.com](https://vercel.com) erstellen (kostenlos, Login z. B. mit GitHub-Account möglich)
2. "Add New..." → "Project" klicken
3. Euer GitHub-Repository `trikot-auktion` auswählen und importieren
4. Bei den Einstellungen nichts ändern, einfach auf "Deploy" klicken (der erste Deploy-Versuch schlägt evtl. fehl, weil die Datenbank noch fehlt – das ist normal, siehe Schritt 3)

## Schritt 3: Datenbank (Upstash Redis über den Marketplace) einrichten

Hinweis: „Vercel KV" gibt es nicht mehr als eigenes Produkt – Vercel hat das im Hintergrund auf Upstash Redis umgestellt. Ihr bindet Upstash jetzt direkt über den Marketplace ein:

1. Im Vercel-Projekt auf den Reiter **"Storage"** gehen
2. **"Create Database"** klicken – es öffnet sich die Liste "Browse Storage"
3. Unter **"Marketplace Database Providers"** auf **"Upstash"** klicken ("Serverless DB (Redis, Vector, Queue, Search)")
4. Falls gefragt: **"Redis"** als Produkt auswählen
5. Eine neue Datenbank erstellen (Name frei wählbar, kostenloser Tarif reicht locker) und mit eurem Projekt verbinden ("Connect Project")
6. Vercel/Upstash setzt die nötigen Umgebungsvariablen (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) automatisch

## Schritt 4: Bildspeicher (Vercel Blob) einrichten

1. Wieder im Reiter **"Storage"** → **"Create Database"**
2. Diesmal **"Blob"** auswählen (oben in der Liste, "Fast object storage")
3. Ebenfalls mit dem Projekt verbinden
4. Auch hier wird die nötige Umgebungsvariable (`BLOB_READ_WRITE_TOKEN`) automatisch gesetzt

## Schritt 5: Admin-Passwort setzen

1. Im Vercel-Projekt zu **"Settings" → "Environment Variables"** gehen
2. Neue Variable hinzufügen:
   - Name: `ADMIN_PASSWORD`
   - Wert: euer gewünschtes Passwort (nicht das Beispiel-Passwort verwenden!)
3. Speichern

## Schritt 6: Neu deployen

1. Zurück zum Reiter **"Deployments"**
2. Beim letzten Deployment auf die drei Punkte → **"Redeploy"** klicken
   (jetzt sind Datenbank, Bildspeicher und Passwort korrekt eingerichtet)

## Fertig!

Ihr bekommt von Vercel eine Adresse wie `https://trikot-auktion-xyz.vercel.app` – das ist eure öffentliche, dauerhafte Auktionsseite. Diesen Link könnt ihr im Verein teilen.

## Bedienung

- **Bieten**: Jeder Besucher kann direkt auf "Bieten" klicken – kein Account nötig
- **Vorstandsbereich**: Zahnrad-Symbol unten rechts anklicken, Passwort eingeben (das aus Schritt 5)
- Im Vorstandsbereich könnt ihr:
  - Vereinsnamen und Enddatum ändern
  - Auktion manuell beenden/wieder öffnen
  - Trikots umbenennen, Startpreis ändern, Fotos **direkt hochladen** (Datei-Auswahl, keine URL nötig)
  - Trikots entfernen
  - Die komplette Gebotshistorie pro Trikot einsehen und einzelne (z. B. verdächtige/Fake-) Gebote entfernen

## Kosten

Für einen Vereins-Auktion in diesem Umfang (ca. 20–25 Trikots, ein paar hundert Besucher) bleibt ihr komfortabel innerhalb der kostenlosen Vercel-, KV- und Blob-Kontingente. Es sollten keine Kosten anfallen.

## Support / Weiterentwicklung

Bei Fragen zur Anpassung (Design, weitere Felder, etc.) einfach den Code-Ordner wieder in einen Chat mit Claude hochladen und die gewünschte Änderung beschreiben.
