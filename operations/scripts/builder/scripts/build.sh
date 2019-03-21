#!/usr/bin/env bash

cp ./package.json ./package.json.orig
cp ./package-lock.json ./package-lock.json.orig
sed -i 's/git+ssh/git+https/g' ./package.json
sed -i 's/git+ssh/git+https/g' ./package-lock.json
npm install
if [ -d "dist" ]; then rm -rf dist; fi
sed -i '/dist/d' ./.gitignore
if [ -d "distribution" ]; then rm -rf distribution; fi
sed -i '/distribution/d' ./.gitignore

npm run lint
if [ "$?" != 0 ]; then exit 1; fi
npm run test
if [ "$?" != 0 ]; then exit 2; fi
npm run build
if [ "$?" != 0 ]; then exit 3; fi

rm ./package.json && mv ./package.json.orig ./package.json
rm ./package-lock.json && mv ./package-lock.json.orig ./package-lock.json

PACKAGE_VERSION=v$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",\t ]//g')
git commit -am "Autobuilt version: $PACKAGE_VERSION" -q
git tag -a "$PACKAGE_VERSION" -m "Tagging version: $PACKAGE_VERSION"
git push origin release --force --tags
