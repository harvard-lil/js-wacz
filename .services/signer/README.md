To test js-wacz against a locally-running signing service, install
[mkcert](https://github.com/FiloSottile/mkcert). Then, in this
directory, run

```
bash ./run.sh
```

(An equivalent is `npm run dev-signer`. Note that this will overwrite
the top-level `.env`.)
