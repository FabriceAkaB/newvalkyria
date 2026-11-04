"""Lit la boîte info@newvalkyria.com (Gmail IMAP, tous les messages) en lecture seule.
Lancé par un test temporaire qui passe U et P (identifiants de getMailConfig()) en variables d'environnement ;
jamais de mot de passe affiché. Arguments : critères IMAP, ex. '(FROM "x@y.com")' '(TEXT "Laurianne")'.
Affiche pour chaque message : date | de | à | sujet | Message-ID, puis le début du texte."""
import email, imaplib, os, sys
from email.header import decode_header

def d(s):
    if not s:
        return ""
    out = ""
    for t, enc in decode_header(s):
        out += t.decode(enc or "utf-8", "replace") if isinstance(t, bytes) else t
    return out

M = imaplib.IMAP4_SSL("imap.gmail.com")
M.login(os.environ["U"], os.environ["P"])
typ, boxes = M.list()
allbox = [b.decode() for b in boxes if b"\\All" in b]
M.select(allbox[0].split(' "/" ')[-1] if allbox else "INBOX", readonly=True)
for q in sys.argv[1:] or ['(SINCE "01-Nov-2026")']:
    typ, data = M.search(None, q)
    ids = data[0].split()[-10:]
    print("Q", q, len(data[0].split()))
    for i in ids:
        typ, m = M.fetch(i, "(RFC822)")
        msg = email.message_from_bytes(m[0][1])
        body = ""
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                break
        print("---", d(msg["Date"]), "|", d(msg["From"]), "|", d(msg["To"]), "|", d(msg["Subject"]), "|", msg["Message-ID"])
        print(body[:2500])
