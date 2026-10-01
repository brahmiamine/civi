#!/usr/bin/env python3
"""Collecte les centres et sessions publiques CCI pour l'examen civique."""

from __future__ import annotations

import argparse
import html
import json
import random
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import requests

BASE_URL = "https://francais.cci-paris-idf.fr"
CANDIDAT_URL = f"{BASE_URL}/candidat"
SEARCH_URL = f"{BASE_URL}/candidat/search-results"
DEFAULT_PRODUCT = "22"
IDF_POSTAL_PREFIXES = ("75", "77", "78", "91", "92", "93", "94", "95")
PRODUCTS = {
    "22": "Examen civique mention Carte de résident",
    "21": "Examen civique mention Carte de séjour pluriannuelle",
    "23": "Examen civique mention Naturalisation",
}
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)


class CardsParser(HTMLParser):
    FIELD_CLASSES = {
        "session-card__status": "status",
        "session-card__title": "name",
        "session-card__availability": "availability_raw",
        "session-card__address": "address",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.cards: list[dict[str, Any]] = []
        self.card: dict[str, Any] | None = None
        self.depth = 0
        self.field: str | None = None
        self.parts: list[str] = []

    def flush(self) -> None:
        if self.card is not None and self.field:
            self.card[self.field] = " ".join("".join(self.parts).split())
        self.field = None
        self.parts = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: (v or "") for k, v in attrs}
        classes = a.get("class", "").split()
        if self.card is None:
            if tag == "div" and "session-card" in classes:
                self.card = {
                    "location_id": a.get("data-location-id", ""),
                    "name": "", "status": "", "address": "",
                    "availability_raw": "", "product_label": "",
                    "choisir_url": "",
                }
                self.depth = 1
            return

        if tag == "div":
            self.depth += 1
        for css_class, field in self.FIELD_CLASSES.items():
            if css_class in classes:
                self.flush()
                self.field = field
                break
        else:
            if tag == "span" and not a.get("class") and self.field is None:
                self.field = "product_label"

        if tag == "a":
            href = a.get("href", "")
            if "/inscription-candidat/centre-" in href:
                self.card["choisir_url"] = html.unescape(href)

    def handle_data(self, data: str) -> None:
        if self.card is not None and self.field:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.card is None:
            return
        if tag in ("div", "span") and self.field:
            self.flush()
        if tag == "div":
            self.depth -= 1
            if self.depth == 0:
                self.cards.append(self.card)
                self.card = None


INPUT_RE = re.compile(r"<input\b[^>]*session_date_y_m_d[^>]*>", re.I)
ATTR_RE = re.compile(r'([\w:-]+)="([^"]*)"')
LABEL_RE = re.compile(r'<label\b[^>]*for="([^"]+)"[^>]*>([^<]*)</label>', re.I)
ADDRESS_RE = re.compile(
    r'info-list__label">\s*Adresse\s*:</span>\s*'
    r'<span class="info-list__value">\s*(.*?)\s*</span>',
    re.S,
)


def parse_cards(fragment: str) -> list[dict[str, Any]]:
    parser = CardsParser()
    parser.feed(fragment)
    for card in parser.cards:
        postal = re.search(r"(?<!\d)(\d{5})(?!\d)", card.get("address", ""))
        card["postal_code"] = postal.group(1) if postal else None
        match = re.search(r"centre-([\w-]+)/produit-([\w-]+)", card.get("choisir_url", ""))
        card["center_id"] = match.group(1) if match else None
        card["product_id"] = match.group(2) if match else None
    return parser.cards


def parse_sessions(page: str) -> list[dict[str, Any]]:
    labels = {m.group(1): html.unescape(m.group(2)).strip() for m in LABEL_RE.finditer(page)}
    sessions: list[dict[str, Any]] = []
    for match in INPUT_RE.finditer(page):
        attrs = dict(ATTR_RE.findall(match.group(0)))
        label = labels.get(attrs.get("id", ""), "")
        date_label, _, time_label = label.partition(" ")
        remaining = attrs.get("remaining_places", "")
        sessions.append({
            "date": attrs.get("session_date_y_m_d", "") or date_label,
            "time": time_label,
            "remaining_places": int(remaining) if remaining.isdigit() else None,
            "session_id": attrs.get("value", ""),
        })
    return sessions


def parse_address(page: str) -> str:
    match = ADDRESS_RE.search(page)
    if not match:
        return ""
    value = re.sub(r"<[^>]+>", " ", match.group(1))
    return html.unescape(" ".join(value.split()))


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    })
    return session


def csrf_token(session: requests.Session, timeout: float) -> str:
    response = session.get(CANDIDAT_URL, timeout=timeout)
    response.raise_for_status()
    match = re.search(r'name="search_center\[_token\]"[^>]*value="([^"]*)"', response.text)
    return match.group(1) if match else "csrf-token"


def search_centers(session: requests.Session, product: str, token: str, timeout: float) -> list[dict[str, Any]]:
    payload = {
        "search_center[cityCountry]": "",
        "search_center[product]": product,
        "search_center[dateStart]": "",
        "search_center[dateEnd]": "",
        "search_center[_token]": token,
        "country_code": "fr",
        "city": "",
    }
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "Origin": BASE_URL,
        "Referer": CANDIDAT_URL,
    }

    for attempt in range(2):
        response = session.post(SEARCH_URL, data=payload, headers=headers, timeout=timeout)
        response.raise_for_status()
        fragment = (response.json().get("html") or "").strip()
        if fragment:
            return parse_cards(fragment)
        payload["search_center[_token]"] = csrf_token(session, timeout)
        if attempt == 0:
            time.sleep(2)
    raise RuntimeError("La recherche CCI a renvoyé une réponse vide.")


def fetch_sessions(
    session: requests.Session,
    path: str,
    timeout: float,
    retries: int = 2,
) -> tuple[list[dict[str, Any]], str]:
    url = path if path.startswith("http") else BASE_URL + path
    last_error: requests.RequestException | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, timeout=timeout, allow_redirects=True)
            response.raise_for_status()
            return parse_sessions(response.text), parse_address(response.text)
        except requests.RequestException as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(2 * attempt)
    assert last_error is not None
    raise last_error


def sleep(delay: float) -> None:
    if delay > 0:
        time.sleep(delay + random.uniform(0, delay / 2))


def collect(product: str, france: bool, delay: float, timeout: float) -> list[dict[str, Any]]:
    session = build_session()
    cards = search_centers(session, product, csrf_token(session, timeout), timeout)
    if not france:
        cards = [
            card for card in cards
            if card.get("postal_code") and str(card["postal_code"]).startswith(IDF_POSTAL_PREFIXES)
        ]

    output: list[dict[str, Any]] = []
    for index, card in enumerate(cards, 1):
        path = card.get("choisir_url", "")
        if not path:
            continue
        print(f"[{index}/{len(cards)}] {card.get('name') or card.get('center_id')}…", flush=True)
        try:
            sessions, complete_address = fetch_sessions(session, path, timeout)
        except requests.RequestException as exc:
            print(f"  ! centre ignoré après échec réseau : {exc}", file=sys.stderr)
            continue
        output.append({
            "center_id": card.get("center_id"),
            "center_name": card.get("name", ""),
            "product": card.get("product_label") or PRODUCTS.get(product, ""),
            "product_id": card.get("product_id") or product,
            "address": complete_address or card.get("address", ""),
            "postal_code": card.get("postal_code"),
            "url_centre": path,
            "sessions": sorted(sessions, key=lambda s: (s["date"], s["time"])),
        })
        sleep(delay)

    output.sort(key=lambda center: center["center_name"].lower())
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", default=DEFAULT_PRODUCT, choices=sorted(PRODUCTS))
    parser.add_argument("--france", action="store_true")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--output", type=Path, default=Path("cci_sessions.json"))
    args = parser.parse_args()

    try:
        centers = collect(args.product, args.france, args.delay, args.timeout)
    except (requests.RequestException, RuntimeError, ValueError) as exc:
        print(f"Erreur CCI : {exc}", file=sys.stderr)
        return 1

    if not centers or not any(center["sessions"] for center in centers):
        print("Erreur CCI : aucune session récupérée ; l'ancien JSON doit être conservé.", file=sys.stderr)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(centers, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(centers)} centres écrits dans {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
