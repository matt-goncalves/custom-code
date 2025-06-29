#!/usr/bin/env bash

SCRIPTS_JS="$HOME/.local/custom-code/scripts_js"

md2std()
{
  node "$SCRIPTS_JS/md2std/index.js" "$@"
}

j2std()
{
  node "$SCRIPTS_JS/j2std/index.js" "$@"
}
