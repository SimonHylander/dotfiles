"""Measure how many bytes of a cache directory share APFS blocks with node_modules files.

Usage: python3 -I clone_overlap.py CACHE_DIR ROOT [ROOT...]
Prints JSON: cache_bytes, shared_bytes, unknown_bytes, unshared_bytes.

Bun installs packages by cloning cache files (clonefile), so deleting the cache
frees only the cache blocks no node_modules file still references. Two files
share a clone when offset 0 of each maps to the same device offset, which
fcntl F_LOG2PHYS_EXT reports. Files the call fails on (compressed or empty)
count as unknown.
"""

import fcntl
import json
import os
import struct
import sys
from multiprocessing import Pool

F_LOG2PHYS_EXT = 65
LOG2PHYS = struct.Struct("<Iqq")  # l2p_flags, l2p_contigbytes, l2p_devoffset (pack 4)


def devoffset(path):
    try:
        fd = os.open(path, os.O_RDONLY)
    except OSError:
        return None
    try:
        out = fcntl.fcntl(fd, F_LOG2PHYS_EXT, LOG2PHYS.pack(0, 1, 0))
        return LOG2PHYS.unpack(out)[2]
    except OSError:
        return None
    finally:
        os.close(fd)


def files_under(top, only_node_modules):
    for root, dirs, names in os.walk(top):
        if only_node_modules and "node_modules" not in root.split(os.sep):
            dirs[:] = [d for d in dirs if not d.startswith(".git")]
            continue
        for name in names:
            path = os.path.join(root, name)
            try:
                st = os.lstat(path)
            except OSError:
                continue
            if st.st_size > 0 and (st.st_mode & 0o170000) == 0o100000:
                yield path, st.st_size, st.st_blocks * 512, st.st_nlink


def probe(item):
    return item, devoffset(item[0])


def main():
    cache, roots = sys.argv[1], sys.argv[2:]
    cache_files = list(files_under(cache, only_node_modules=False))
    sizes = {size for _, size, _, _ in cache_files}
    # Only a node_modules file with the same size as some cache file can be its clone.
    nm_files = [f for root in roots for f in files_under(root, only_node_modules=True) if f[1] in sizes]

    with Pool(8) as pool:
        nm_offsets = {off for _, off in pool.imap_unordered(probe, nm_files, chunksize=512) if off is not None}
        cache_bytes = shared = unknown = 0
        for (path, _, alloc, nlink), off in pool.imap_unordered(probe, cache_files, chunksize=512):
            cache_bytes += alloc
            if nlink > 1 or (off is not None and off in nm_offsets):
                shared += alloc
            elif off is None:
                unknown += alloc

    print(json.dumps({
        "cache_bytes": cache_bytes,
        "shared_bytes": shared,
        "unknown_bytes": unknown,
        "unshared_bytes": cache_bytes - shared - unknown,
    }))


if __name__ == "__main__":
    main()
