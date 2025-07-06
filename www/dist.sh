set -e # fail on error
set -x # echo commands

rm -rf dist && bun build --target=bun --production --outdir=dist index.ts && cp sources.tar dist/

docker build -t zdocs:0.0.1 .
