openssl req -new -x509 -nodes \
-out cert.pem \
-keyout key.pem \
-newkey ec \
-pkeyopt ec_paramgen_curve:prime256v1 \
-subj "/CN=141.57.68.184" \
-days 14
