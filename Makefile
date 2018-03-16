all: setup lint cover docs

setup:
	npm install

run:
	npm start

lint:
	npm run lint

test:
	npm test
.PHONY: test

cover:
	npm run cover

docs:
	npm run docs
.PHONY: docs

docs-serve:
	npm run docs-serve

clean:
	rm -rf node_modules
