all: setup lint cover docs

setup:
	npm install

run:
	npm start

lint:
	npm run lint

link:
	ln -sfT $$(node -e \"console.log(require('path').dirname(require.resolve('stencila/package.json')))\")/build static/stencila

test:
	npm test

cover:
	npm run cover

docs:
	npm run docs
.PHONY: docs

docs-serve:
	npm run docs-serve

clean:
	rm -rf node_modules
