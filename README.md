# Manview

*Unix manual pages online viewer*

*Manview* dynamically presents a Unix manual page formatted
in _troff_ as an HTML web page.


## Using the hosted version of Manview

The easiest way to use _Manview_ is by filling-in
[this web page](https://dspinellis.github.io/manview/setup.html)
and depend on GitHub's hosted version to serve requests
for Unix manual pages also hosted on GitHub.

To create a manual page view URL by hand,
pass the URL where the manual source page is located in an `src`
query argument to the URL <code>https://dspinellis.github.io/manview/</code>.
You can also pass the page's title in the `name` query
argument and its hyperlink in the `link` query argument.

To avoid cross-origin problems the response
(and any redirections leading to it) should include
an appropriate CORS `Access-Control-Allow-Origin` header.
(It's a good idea to avoid redirecting URLs.)

As an example of the hosted _Manview_ use, the
[Evolution of Unix Facilities](https://dspinellis.github.io/unix-history-man/)
web site contains links to 193,781 dynamically-generated historic
and current Unix manual pages.

See also the _Manview_ Unix-style
[manual page](https://dspinellis.github.io/manview/).


## Contributing

To support more _troff_ macros, issue a GitHub pull request against the
employed [jroff fork](https://github.com/dspinellis/jroff/).
Even though all macros are supported concurrently, please group
them by the macro package they belong to.

For other enhancements issue a GitHub pull request against this
repository.

## Dependencies and components
*Manview* depends on the following packages for its operation.

- Node.js
- Grunt.js
- Bower
- libsass

*Manview* is also heavily based on a
([forked](https://github.com/dspinellis/jroff/) and enhanced) version of
[Jroff](https://github.com/roperzh/jroff),
[essential.js](http://roperzh.github.io/essential.js/), and
[Grapse](https://github.com/roperzh/grapse).

## Self-hosting

To host _Manview_ on your own
just clone the project and install the dependencies.

```sh
git clone https://github.com/dspinellis/manview
npm install
npx bower install
npx grunt build
npx grunt
```

## Development

* To update the distributed version of _jroff_:
`cp  ../jroff/dist/jroff.js  assets/vendor/jroff/dist/jroff.js`

* To run the current version for testing:

```bash
npx grunt build
npx grunt
```
or
```
cd dist
python -m SimpleHTTPServer 3000
```


* Point your browser to a URL such as [http://localhost:3000/?src=https://raw.githubusercontent.com/dspinellis/git-issue/master/git-issue.1](http://localhost:3001/?src=https://raw.githubusercontent.com/dspinellis/git-issue/master/git-issue.1)

## Deployment

To deploy the hosted version,
commit and push all your changes on the master branch, and then run

```sh
npm run deploy
git push origin gh-pages
```

