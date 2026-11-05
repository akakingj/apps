#!/bin/sh
# Run after uploading the kit to the MGU. Defaults to read-only checks.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY=/var/opt/mgu-deploy/mgu-deploy.sh
[ -f "$DEPLOY" ] || DEPLOY=/var/opt/mgu-deploy/current/mgu-deploy.sh
[ -f "$DEPLOY" ] || { echo 'mgu-deploy is not installed' >&2; exit 1; }
MODE=${1:-check}
case "$MODE" in check|install) ;; *) echo 'Usage: sh install-on-mgu.sh [check|install]' >&2; exit 2;; esac
/usr/bin/node "$HERE/preflight.js"
PACKAGE=$(/usr/bin/node "$HERE/preflight.js" --package "$HERE")
sh "$DEPLOY" check --artifact "$PACKAGE"
if [ "$MODE" = install ]; then
    [ "$(id -u)" = 0 ] || { echo 'Install must run as root' >&2; exit 1; }
    sh "$DEPLOY" install --artifact "$PACKAGE" --yes
else
    echo 'Read-only checks passed. To install: sh install-on-mgu.sh install'
fi
