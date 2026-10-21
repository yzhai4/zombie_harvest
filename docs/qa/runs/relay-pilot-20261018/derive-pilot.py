"""Read original terminal pilot artifacts without changing them; emit companion facts."""
import argparse
import hashlib
import json
from pathlib import Path

def digest(data):
    return hashlib.sha256(data).hexdigest()

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def derive(base):
    result = {'schema': 'RelayPilotCompanionV1', 'scope': 'postprocess only; original reports unchanged',
              'sourceHtmlSha256': 'c21cedd145fe9e2db4b224f727c0e7bceaedfefaba31a37b73dbe3a7308f1571',
              'arms': {}, 'checkedFileReferences': 0, 'comparisonSupportsFoodCausality': False,
              'runtimeChanged': False, 'naturalThreeDays': False, 'humanExperienceResults': False}
    for arm in ['A', 'B']:
        folder = base / f'browser-{arm}-method03'
        raw = (folder / 'report.json').read_bytes()
        report = json.loads(raw)
        assert report['sourceHtmlSha256'] == result['sourceHtmlSha256']
        for file, expected in [('source.html', report['sourceHtmlSha256']),
                               ('input-native.json', report['inputSha256']),
                               ('method-executed.mjs', report['methodSha256']),
                               ('protocol-executed.md', report['protocolSha256'])]:
            assert digest((folder / file).read_bytes()) == expected, file
            result['checkedFileReferences'] += 1
        for snapshot in report['snapshots']:
            for row in snapshot['files']:
                assert digest((folder / row['file']).read_bytes()) == row['sha256'], row['file']
                result['checkedFileReferences'] += 1
        for document in report['documents']:
            assert document['status'] == 200
            assert document['sha256'] == result['sourceHtmlSha256']
            assert digest((folder / document['file']).read_bytes()) == document['sha256']
            result['checkedFileReferences'] += 1
        assert report['cleanup']['contextClosed'] and not report['errors']
        final = report['snapshots'][-1]
        assert final['label'] == 'final'
        native_file = next(r for r in final['files'] if r['kind'] == 'actual-localStorage-writer')
        ui_file = next(r for r in final['files'] if r['kind'] == 'public-DOM')
        payload = read_json(folder / native_file['file'])['payload']
        ui = read_json(folder / ui_file['file'])
        commitments = []
        for action in report['actions']:
            events = action.get('newEvents', [])
            parents = [c for c in action.get('newCommands', []) if c['type'] != 'world.advance']
            for command in parents:
                rejected = any(e['type'] == 'command.rejected' and e.get('commandId') == command['commandId'] for e in events)
                if rejected:
                    continue
                commitments.append({'actionLabel': action.get('label'), 'commandId': command['commandId'],
                                    'type': command['type'], 'operatorMarkedMajor': action.get('major', False),
                                    'causedAdvances': [e for e in events if e['type'] == 'time.advanced' and e.get('causationId') == command['commandId']],
                                    'businessEvents': [e for e in events if e['type'] in ['landmark.discovered', 'special.itemRecovered', 'threat.attacked', 'relay.coreHandoff']]})
        result['arms'][arm] = {'originalReportSha256': digest(raw), 'originalReportBytes': len(raw),
                              'terminal': report['status'], 'elapsedWallMs': report['elapsedWallMs'],
                              'runnerMajorActions': report['majorActions'], 'actualAcceptedBusinessCommands': commitments,
                              'correctedMajorActions': len(commitments),
                              'originalInteractionAttempts': report['interactionAttempts'],
                              'correctedInteractionAttempts': report['interactionAttempts'] + sum(not c['operatorMarkedMajor'] for c in commitments),
                              'finalPublic': {k: ui[k] for k in ['day', 'hour', 'minute', 'hp', 'energy', 'food', 'player']},
                              'lastDurable': {k: payload.get(k) for k in ['day', 'hour', 'minute', 'hp', 'food', 'gameOver', 'specialItems', 'relayProject']},
                              'lastDurableFilename': native_file['file'], 'finalPublicFilename': ui_file['file'],
                              'mainDocumentCount': len(report['documents']), 'contextClosed': True,
                              'refreshCovered': any(a['kind'] == 'reload' for a in report['actions'])}
    assert result['arms']['A']['terminal'] == 'GAMEPLAY_LOSS'
    assert result['arms']['A']['finalPublic']['hp'] == 0
    assert result['arms']['A']['lastDurable']['hp'] == 8
    assert result['arms']['A']['lastDurable']['relayProject']['status'] == 'core-recovered'
    assert result['arms']['A']['correctedMajorActions'] == 2
    assert result['arms']['B']['terminal'] == 'INTERRUPTED_RISK'
    assert result['arms']['B']['correctedMajorActions'] == 0
    assert result['arms']['B']['lastDurable']['relayProject']['status'] == 'unknown'
    cleanup = read_json(base / 'browser-cleanup.json')
    assert cleanup['browserClosed'] and cleanup['serverClosed']
    result['cleanup'] = cleanup
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    assert not args.out.exists(), 'new companion output required'
    facts = derive(args.base)
    args.out.write_text(json.dumps(facts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'out': args.out.name, 'checkedFileReferences': facts['checkedFileReferences'],
                      'A': facts['arms']['A']['terminal'], 'B': facts['arms']['B']['terminal'],
                      'correctedMajorActions': {k: v['correctedMajorActions'] for k, v in facts['arms'].items()}}, ensure_ascii=False))
