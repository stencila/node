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

clean:
	rm -rf node_modules