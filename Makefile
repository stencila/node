all: setup lint check cover docs

setup:
	npm install

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

clean:
	rm -rf node_modules
