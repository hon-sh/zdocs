set -e # fail on error
set -x # echo commands

rm -rf dist
bun build --target=bun --production --outdir=dist index.ts
cp -r pkgs dist/

docker build -t zdocs:0.0.2-pre .

# manual tag & push
# docker tag zdocs:0.0.1 ghcr.io/hon-sh/zdocs:0.0.1
