# manview

*Unix manual pages online viewer*

*Manview* is heavily based on
[Jroff](https://github.com/roperzh/jroff),
[essential.js](http://roperzh.github.io/essential.js/), and
[Grapse](https://github.com/roperzh/grapse).

## Contributing:

### Dependencies:

- Node.js
- Grunt.js
- Bower
- libsass

### Getting started

Just clone the project and install the dependencies!

```bash
$ git clone https://github.com/dspinellis/manview
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
query argument.
To avoid same-origin problems the response
(and any redirections leading to it) should include
an appropriate CORS `Access-Control-Allow-Origin` header.
(It's a good idea to avoid redirecting URLs.)
You can also pass the page's title in the `name` query
argument and its hyperlink in the `link` query argument.
As an example of this page's use, the
[Evolution of Unix Facilities](https://dspinellis.github.io/unix-history-man/)
web site contains links to 193,781 dynamically-generated historic
and current Unix manual pages.
