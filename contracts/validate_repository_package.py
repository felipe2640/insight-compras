"""Validate the exact document-only transfer package without host runtime files."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'contracts/repository-package-manifest.json').read_text())
files = manifest['files']
errors = []
links_checked = 0
email_domains = set()
urls = set()
phones = set()
for name in files:
    path = ROOT / name
    if not path.is_file() or not path.stat().st_size:
        errors.append('missing or empty: ' + name)
        continue
    if path.suffix not in {'.md', '.py', '.json', '.yaml', '.txt'}:
        errors.append('unexpected file type: ' + name)
    content = path.read_text()
    if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live_|sb_secret_|ghp_)[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', content):
        errors.append('secret-shaped material: ' + name)
    for address in re.findall(r'[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})', content):
        email_domains.add(address)
        if not (address.endswith('.example') or address.endswith('.test') or address in {'example.com', 'example.org'}):
            errors.append('non-synthetic email domain: ' + name + ': ' + address)
    phones.update(re.findall(r'\+\d{10,15}', content))
    urls.update(re.findall(r'https?://[^\s`"\'<>)}]+', content))
    if path.suffix == '.md':
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', content):
            if target.startswith(('https://', 'http://', '#', 'mailto:')):
                continue
            target = target.split('#')[0].strip('<>')
            candidates = [path.parent / target, ROOT / target]
            links_checked += 1
            if not any(p.exists() and p.resolve().is_relative_to(ROOT) for p in candidates):
                errors.append('broken Markdown link: ' + name + ': ' + target)
# Root-qualified inline paths/globs are checked unless explicitly historical.
allowed_historical = ('docs/cotacao/', 'outputs/', '.agents/orchestrator_cotacao/DISPATCH', '.agents/orchestrator_cotacao/plan.md', '.agents/orchestrator_cotacao/pedidos-de-contrato', 'docs/archive/pre-g0/', '.agents/orchestrator_cotacao/reviews/auditor-v2', '.agents/orchestrator_cotacao/reviews/challenger-v2', '.agents/orchestrator_cotacao/reviews/orchestrator-v2')
for name in files:
    if not name.endswith('.md'):
        continue
    for token in re.findall(r'`([^`\n]+)`', (ROOT / name).read_text()):
        if not token.startswith(('docs/', 'contracts/', 'openapi/', '.agents/')):
            continue
        if any(token.startswith(prefix) for prefix in allowed_historical):
            continue
        variants = [token]
        while any('{' in v for v in variants):
            expanded = []
            for v in variants:
                m = re.search(r'\{([^{}]+)\}', v)
                expanded.extend(v[:m.start()] + part + v[m.end():] for part in m[1].split(',')) if m else expanded.append(v)
            variants = expanded
        for v in variants:
            if any(v.startswith(prefix) for prefix in allowed_historical):
                continue
            matches = list(ROOT.glob(v)) if '*' in v else [ROOT / v]
            links_checked += 1
            if not matches or not any(p.exists() for p in matches):
                errors.append('missing inline path: ' + name + ': ' + v)
wire = hashlib.sha256((ROOT / 'openapi/cotacao-hub-v1.yaml').read_bytes()).hexdigest()
if wire != manifest['approved_openapi_sha256']:
    errors.append('approved OpenAPI bytes changed')
result = {'verdict': 'PASS' if not errors else 'BLOCKED', 'files': len(files), 'references_checked': links_checked,
          'broken_references': len([e for e in errors if 'link' in e or 'path' in e]),
          'approved_openapi_sha256': wire, 'email_domains': sorted(email_domains), 'phone_literals': sorted(phones),
          'urls': sorted(urls), 'errors': sorted(set(errors)),
          'audit_limits': 'Pattern scan plus manual review; no scanner proves absence of every secret. Names/prices are synthetic contract data; host names only describe exclusions/integrations.'}
(ROOT / 'contracts/repository-package-validation-result.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({k: result[k] for k in ['verdict', 'files', 'references_checked', 'broken_references', 'errors']}, ensure_ascii=False))
raise SystemExit(bool(errors))
