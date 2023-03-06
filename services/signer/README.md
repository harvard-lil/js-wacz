To test js-wacz against a locally-running signing service, install
[mkcert](https://github.com/FiloSottile/mkcert). Then, in this
directory, run 

```
bash ./run.sh
```

You can then run `npm run test`, setting
`TEST_SIGNING_URL=http://localhost:5000/sign` on the command line or
in `.env`.
