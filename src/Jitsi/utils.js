export const allSettled = (promises) => {
  let wrappedPromises = promises.map(p => Promise.resolve(p)
    .then(
      val => ({ status: "fulfilled", value: val }),
      err => ({ status: "rejected", reason: err })))
  return Promise.all(wrappedPromises)
}
