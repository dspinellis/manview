# manview

*man pages online viewer*

*Manview* is heavily based on
[Jroff](https://github.com/roperzh/jroff),
[essential.js](http://roperzh.github.io/essential.js/), and
[Grapse](https://github.com/roperzh/grapse).

It is currently work in progress.


## Contributing:

### Dependencies:

- Node.js
- Grunt.js
- Bower
- libsass

### Getting started

Just clone the project and install the dependencies!

```bash
$ git clone https://github.com/roperzh/fe-playground.git
$ npm install
$ bower install
$ grunt build
$ grunt
```
### Deployment

In order to deploy, commit and push all your changes on the master
branch, and then run

```bash
$ npm run deploy
```

### Use
Pass the URL where the manual source page is located in an `src`
query string.
To avoid same-origin problems the response
(and any redirections leading to it) should include
an appropriate CORS `Access-Control-Allow-Origin` header.
(It's a good idea to avoid redirecting URLs.)
Examples:
* [Seventh Research Edition ls(1)](https://dspinellis.github.io/manview/?src=https%3A%2F%2Fraw.githubusercontent.com%2Fdspinellis%2Funix-history-repo%2FResearch-V7%2Fusr%2Fman%2Fman1%2Fls.1)
* [4.3 BSD accept(2)](https://dspinellis.github.io/manview/?src=https%3A%2F%2Fraw.githubusercontent.com%2Fdspinellis%2Funix-history-repo%2FBSD-4_3%2Fusr%2Fman%2Fman2%2Fconnect.2)
