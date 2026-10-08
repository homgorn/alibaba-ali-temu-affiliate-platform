# Product Deduplication Techniques - Multimodal Embeddings (Hepsiburada)

**URL:** https://arxiv.org/abs/2509.15858
**Publisher:** arXiv / Hepsiburada
**Publish Date:** 2025-09-19 (v1), 2025-12-01 (v2)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "In large scale e-commerce marketplaces, duplicate product listings frequently cause consumer confusion and operational inefficiencies, degrading trust on the platform and increasing costs. Traditional keyword-based search methodologies falter in accurately identifying duplicates due to their reliance on exact textual matches, neglecting semantic similarities inherent in product titles."

> "Our approach employs a domain-specific text model grounded in BERT architecture in conjunction with MaskedAutoEncoders for image representations. Both of these architectures are augmented with dimensionality reduction techniques to produce compact 128-dimensional embeddings without significant information loss."

> "By integrating these feature extraction mechanisms with Milvus, an optimized vector database, our system can facilitate efficient and high-precision similarity searches across extensive product catalogs exceeding 200 million items with just 100GB of system RAM consumption."

> "Empirical evaluations demonstrate that our matching system achieves a macro-average F1 score of 0.90, outperforming third-party solutions which attain an F1 score of 0.83."

> "Deployed architecture is serving our internal users with 116M as of August 2025 product vectors daily."

---

# Product Deduplication - Methodology Details

**URL:** https://arxiv.org/html/2509.15858v2
**Publisher:** arXiv / Hepsiburada
**Publish Date:** 2025-12-01
**Access Date:** 2026-10-08

## Verbatim Quotes

> "A central challenge in deploying deep models at scale is managing the high dimensionality of representation vectors. Pretrained models like BERTurk and EfficientNetV2 yield 768- and 1792-dimensional vectors, respectively. These vectors are expensive to store, index, and search in large catalogs."

> "To determine the extent of feasible dimensionality reduction, we conducted a feasibility study. A binary decision model was trained using original and compressed versions of BERTurk and EfficientNetV2 representations. The original configuration achieved an F1 score of 0.86. Reducing both embeddings to 512 dimensions using PCA slightly changed the performance to 0.856. Further compression to 256 and 128 dimensions yielded F1 scores of 0.85 and 0.84, respectively. These results demonstrated that deduplication could be performed effectively using 128-dimensional vectors."

> "For textual data, we experimented with using token embeddings from intermediate BERT layers, which strike a balance between raw and highly contextualized representations. To further enhance efficiency, we added a CNN-based aggregation layer to automatically extract salient features from intermediate layers, improving performance while controlling vector size."

> "For the image representations that the decider model is used, we transitioned from traditional AutoEncoders to Masked AutoEncoders (MAE) with a structured patch selection logic, ensuring the preservation of critical visual details unique to e-commerce product images."

> "We introduced a structured patch selection method:
> - Divide the image into 'k' equal patches.
> - Always select the center patch (containing the most information).
> - Select two random patches from the remaining eight.
> - Resize the full image to match a single patch size and use as the last patch.
> - Stack patches as standard MAE inputs."

> "The decider model processes four vectors—two for image and two for text—associated with each product listing and generates a confidence score indicating the likelihood of them being the same product. A key architectural decision was to implement the model as a traditional classifier rather than using siamese or contrastive learning approaches."

> "Table IV: RAM Usage of 10 Million Vectors on Milvus
> | Vector Size | RAM Usage (GB) |
> | --- | --- |
> | 128 | 5.5 |
> | 256 | 10.2 |
> | 512 | 20 |
> | 1024 | 39.7 |"

> "Table V: Inference Times per 1000 Product Pairs
> | Model | Generation Time (sec) |
> | --- | --- |
> | Ours | 10 |
> | CLIP | 62 |
> | BLIP | 302 |"

---

# Perceptual Hashing for Image Deduplication

**URL:** https://www.mdpi.com/2079-9292/15/7/1493
**Publisher:** MDPI Electronics
**Publish Date:** 2024
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Among perceptual hashing techniques, Average Hash (AHash) is commonly used in perceptual hashing-based deduplication and is widely used as a lightweight baseline in comparative studies."

> "Resizing the image: We first normalize the input image by resizing it to a fixed n × n grid (typically 8 × 8), which aggressively down-samples high-frequency details while preserving coarse structures. This ensures the hash is unaffected by changes in the original image dimensions."

> "Difference Hash (DHash): The values of are concatenated row-wise to form a 64-bit DHash fingerprint, representing the dominant horizontal gradient pattern of the image."

> "Perceptual Hash (PHash): Unlike AHash and DHash, which operate in the spatial domain, Perceptual Hash (PHash) works in the frequency domain by applying the Discrete Cosine Transform (DCT) to break the image into frequency components."

> "Comparing hashes using Hamming distance: Similarity between two images is calculated using the Hamming distance between their hash vectors. A smaller Hamming distance indicates greater similarity between images."

> "This highlights that learned deep embeddings are far more effective than perceptual hashing methods at preserving discriminative information in visually diverse and heavily transformed product images."

---

# Scale-Ready Image Deduplication with Cryptographic & Perceptual Hashes

**URL:** https://medium.com/@sudhindra_saxena/scale-ready-image-deduplication-with-cryptographic-perceptual-hashes-ae363f54710f
**Publisher:** Towards Dev / Medium
**Publish Date:** 2025-07-30
**Access Date:** 2026-10-08

## Verbatim Quotes

> "In photo-sharing platforms, cloud storage systems, and social media applications, users often upload the same image multiple times, sometimes with minor changes. These changes might be:
> * A different format (JPEG vs PNG)
> * Slight compression
> * A small rotation or crop
> Storing these near-duplicate images consumes storage, slows indexing, and hampers content moderation and abuse detection."

> "There are two key types of hashes used in image deduplication:
> Cryptographic Hashes
> * Algorithms: MD5, SHA-1 …
> Perceptual Hashes
> * Algorithms: AHash, DHash, PHash, WHash"

---

# LSH Amplification for Product Deduplication

**URL:** https://www.computer.org/csdl/journal/tk/5555/01/11673857/2jqKy6eLwXe
**Publisher:** IEEE Transactions on Knowledge and Data Engineering
**Publish Date:** 2026-08-01
**Access Date:** 2026-10-08

## Verbatim Quotes

> "The aggregation of highly heterogeneous product listings across online webshops suffers from severe scalability limitations and high false positive rates, as identifying duplicates without universal product identifiers typically requires computationally expensive pairwise comparisons."

> "First, we substitute the conventional MinHash sketching technique with Fast Similarity Sketching (FSS). FSS provides faster and more precise Jaccard similarity estimates, inherently reducing the time complexity of the initial hashing process."

> "Second, we develop a parametrized amplification strategy leveraging iterative AND/OR operations on LSH functions to substantially minimize both false positive and false negative rates."

> "Crucially, this amplification strategy improves scalability by allowing the algorithm to achieve higher accuracy while using fewer underlying hash functions, thereby directly decreasing the computational overhead of generating candidate pairs."

> "Empirical evaluations, based on data collected from four webshops, including extensive bootstrap experiments, confirm that combining FSS with amplification consistently outperforms baseline, non-amplified MinHash configurations."