all: setup build

setup:
	npm install

run:
	npm start

lint:
	npm run lint

test:
	npm test

cover:
	npm run cover

docs:
	npm run docs

docs-serve:
	npm run docs-serve

clean:
	rm -rf node_modules
