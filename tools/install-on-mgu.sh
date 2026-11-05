#!/bin/sh
# Defaults to read-only checks; install is an explicit argument.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY=/var/opt/mgu-deploy/mgu-deploy.sh
[ -f "$DEPLOY" ] || DEPLOY=/var/opt/mgu-deploy/current/mgu-deploy.sh
[ -f "$DEPLOY" ] || { echo 'mgu-deploy is not installed' >&2; exit 1; }
MODE=${1:-check}
case "$MODE" in check|install) ;; *) echo 'Usage: sh install-on-mgu.sh [check|install]' >&2; exit 2;; esac
PACKAGES=$(/usr/bin/node "$HERE/check-kit.js" "$HERE")
# Validate every selected artifact before installing the first one.
printf '%s\n' "$PACKAGES" | while IFS= read -r package; do
    sh "$DEPLOY" check --artifact "$package"
done
if [ "$MODE" = install ]; then
    [ "$(id -u)" = 0 ] || { echo 'Install must run as root' >&2; exit 1; }
    printf '%s\n' "$PACKAGES" | while IFS= read -r package; do
        sh "$DEPLOY" install --artifact "$package" --yes
    done
else
    echo 'All selected apps passed read-only checks. To install: sh install-on-mgu.sh install'
fi
