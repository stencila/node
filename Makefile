all: setup lint check cover docs

setup:
	npm install --python=python2.7

run:
	npm start

lint:
	npm run lint

check:
	npm run check

test:
	npm test
.PHONY: test

cover:
	npm run cover

docs:
	npm run docs
.PHONY: docs

clean:
	npm run clean
