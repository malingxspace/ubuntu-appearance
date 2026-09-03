#!/usr/bin/env python3
import ast
import struct
import sys
from pathlib import Path


def read_messages(source):
    messages = {}
    msgid = None
    msgstr = None
    section = None

    def store():
        if msgid is not None and msgstr is not None:
            messages[''.join(msgid)] = ''.join(msgstr)

    for raw_line in source.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if line.startswith('msgid '):
            store()
            msgid = [ast.literal_eval(line[6:])]
            msgstr = None
            section = 'msgid'
        elif line.startswith('msgstr '):
            msgstr = [ast.literal_eval(line[7:])]
            section = 'msgstr'
        elif line.startswith('"'):
            if section == 'msgid':
                msgid.append(ast.literal_eval(line))
            elif section == 'msgstr':
                msgstr.append(ast.literal_eval(line))
    store()
    return messages


def write_mo(messages, destination):
    entries = sorted(
        (msgid.encode('utf-8'), msgstr.encode('utf-8'))
        for msgid, msgstr in messages.items()
    )
    count = len(entries)
    originals = b'\0'.join(msgid for msgid, _ in entries) + b'\0'
    translations = b'\0'.join(msgstr for _, msgstr in entries) + b'\0'
    originals_offset = 28
    translations_offset = originals_offset + count * 8
    strings_offset = translations_offset + count * 8
    translated_strings_offset = strings_offset + len(originals)

    original_table = []
    translated_table = []
    offset = 0
    translated_offset = 0
    for msgid, msgstr in entries:
        original_table.extend((len(msgid), strings_offset + offset))
        translated_table.extend((len(msgstr), translated_strings_offset + translated_offset))
        offset += len(msgid) + 1
        translated_offset += len(msgstr) + 1

    data = struct.pack(
        f'<7I{count * 2}I{count * 2}I',
        0x950412DE, 0, count, originals_offset, translations_offset, 0, 0,
        *original_table, *translated_table,
    ) + originals + translations
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(f'usage: {sys.argv[0]} SOURCE.po DESTINATION.mo')
    write_mo(read_messages(Path(sys.argv[1])), Path(sys.argv[2]))
