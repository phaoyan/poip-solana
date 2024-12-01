# 买断封顶合约（有限买断合约）

知识生产者最初私有知识产权。其为自己设定一个酬劳上限Max，为产品使用权设定一个单价Price，由此可算出需要卖出的数目Count = Max / Price。接着知识生产者在市场中售卖知识产品的使用权，随着售卖的进行，实际售出数目渐渐逼近Count。当实际售出数目达到Count后，知识生产者放弃私有的知识产权，将知识产品的产权公有化，此后所有人可以自由地使用该知识产品。

买断封顶合约是非常简单容易实现的合约，但知识产权的公有化可能会导致购买者的不满，进而大家都倾向于等待知识产品被公有化后无偿地使用，而不愿意在最开始花钱购买知识产品的使用权。为了弥补这一点可能采取的措施：1. 为购买者颁发荣誉 2. 强调购买者先买在时间上的优势，在实际售出数目达到Count之后，并不立即释放知识产权，而是等一段较长的时间再释放知识产权 3. 使用下述买断补偿合约

# 买断补偿合约

知识生产者最初私有知识产权。其为自己设定一个酬劳上限Max，为产品使用权设定一个单价Price，由此可计算处需要卖出的数目Count = Max / Price。接着知识生产者在市场中售卖知识产品的使用权，随着售卖的进行，实际售出数目渐渐逼近Count。当实际售出数目达到Count后，知识生产者并不释放私有的知识产权，但接下来假设有更多人购买该知识产品，他们所花的费用将均匀地补偿给所有购买者（也包括当时的购买者自身），于是久而久之，购买该知识产权使用权的实际花费将越来越便宜，直至近乎免费，而之前的购买者也被同等地补偿，最终在所有购买者都公平地付费的情况下，实现了知识产品使用权的近无价化，进而形成实质上的知识产权公有化。

关于”将费用均匀地补偿给所有购买者“的具体实现方式。合约维护一个账本，其内容包括：

1. 合约的账户余额（不同于知识生产者的账户，合约的账户余额用于保存溢出的金额，以实现补偿购买者，知识生产者无权从中提取金钱）
2. 购买者名单、购买者人数
3. 每一个购买者已提现的金额
4. 酬劳上限、产品单价

   在新的购买者购买知识产品的使用权时，首先将他计入购买者名单中，此时购买者人数自然加一，接着将购买者所花的钱转账到合约的账户余额中。

   在一个已购买者想要提现补偿金额时，首先查看他已经提现的金额，然后计算当前时间节点下每个已购买者应得的补偿金额，可以用下列公式计算：
   $$
   Amount = \frac{[(BuyerCount \times Price) - Max]}{BuyerCount} = Price - \frac{Max}{BuyerCount}
   $$
   接着用应得补偿金额减去已提现的金额，就可以计算出此次他应提现的金额。体现完成后，再将已提现金额更新为当前的应得补偿金额即可。

基于上述逻辑，可以进一步降低购买的门槛，即将购买与立即提现补偿金额结合起来，购买者只需支付单价-当前应得补偿金额即可购买到使用权，但是在购买完成后立即将购买者的已提现金额设置为当前的应得补偿金额。

买断补偿合约仍有一个缺点，即知识产品的所有权在形式上仍然是私有的，只是其使用权会随着购买人数的增多逐渐趋于免费。如果要进一步推动知识产品的公有化，可以采用下述买断补偿公有化合约。

# 买断补偿公有化合约

知识生产者最初私有知识产权。其为自己设定一个酬劳上限Max，为产品使用权设定一个单价Price，由此可计算处需要卖出的数目Count = Max / Price。此外，知识生产者规定一个补偿金上限MaxCompensation，这个补偿金上限不会超过Price，但理想状态应当接近Price。接着知识生产者在市场中售卖知识产品的使用权，随着售卖的进行，实际售出数目渐渐逼近Count。当实际售出数目达到Count后，知识生产者并不释放私有的知识产权，但接下来假设有更多人购买该知识产品，他们所花的费用将均匀地补偿给所有购买者（也包括当时的购买者自身），于是久而久之，购买该知识产权使用权的实际花费将越来越便宜，与此同时，每一个已购买者的补偿金也越来越接近补偿金上限。当当前每个购买者的应得补偿金达到补偿金上限后，知识生产者放弃私有的知识产权，而将知识产品的产权公有化。

关于如何识别”当前每个购买者的应得补偿金达到补偿金上限“。应得补偿金与购买者总人数密切相关，因此实际上我们只需要持续对购买者总人数进行计数，当购买者总人数达到一定数量后，补偿金自然达到上限。具体而言，购买者总人数上限可以用如下公式计算：

$$

MaxBuyerCount\times Price - Max = MaxBuyerCount\times MaxCompensation \\\\

MaxBuyerCount = \frac{Max}{Price - MaxCompensation}

$$

# 合约的可行性

最后，上述买断封顶合约、买断补偿合约和买断补偿公有化合约在**区块链技术**背景下均非常容易实现，笔者接下来会尝试使用Solidity编写上述三种合约的具体实现。