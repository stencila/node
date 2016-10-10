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
	documentation build --config docs.yml

docs-serve:
	documentation serve --config docs.yml --watch

clean:
	rm -rf node_modules