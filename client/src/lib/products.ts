// Static product catalog — no backend needed
export interface Product {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  tags: string[];
  imageUrl: string;
  inStock: boolean;
  stockQuantity?: number;
  sku: string;
  featured: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PRODUCTS: Product[] = [
  { id:"1", name:"BPC-157", slug:"bpc-157", subtitle:"Body Protection Compound", description:"BPC-157 is a synthetic peptide consisting of 15 amino acids, discovered in and isolated from human gastric juice. For laboratory research use only.", price:4999, compareAtPrice:6999, category:"Peptides", tags:["research","peptide"], imageUrl:"/images/bpc-157.png", inStock:true, stockQuantity:100, sku:"BPC-157-10MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"2", name:"TB-500", slug:"tb-500", subtitle:"Thymosin Beta-4 Fragment", description:"TB-500 is a synthetic version of the naturally occurring peptide present in virtually all human and animal cells. Research compound for laboratory use only.", price:5999, compareAtPrice:7999, category:"Peptides", tags:["research","peptide"], imageUrl:"/images/tb-500.png", inStock:true, stockQuantity:80, sku:"TB-500-10MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"3", name:"GHK-Cu", slug:"ghk-cu", subtitle:"Copper Peptide Complex", description:"GHK-Cu is a naturally occurring copper complex of the tripeptide glycyl-L-histidyl-L-lysine. Research compound for laboratory use only.", price:5499, compareAtPrice:7499, category:"Peptides", tags:["research","peptide","copper"], imageUrl:"/images/ghk-cu.png", inStock:true, stockQuantity:60, sku:"GHK-CU-50MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"4", name:"PT-141", slug:"pt-141", subtitle:"Bremelanotide", description:"PT-141 (Bremelanotide) is a melanocortin receptor agonist. Research compound for laboratory use only.", price:4999, compareAtPrice:6499, category:"Peptides", tags:["research","peptide"], imageUrl:"/images/pt-141.png", inStock:true, stockQuantity:40, sku:"PT141-10MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"5", name:"CJC-1295 + Ipamorelin", slug:"cjc-ipamorelin", subtitle:"GHRH Blend", description:"CJC-1295 and Ipamorelin are often studied together as complementary growth hormone secretagogues. Research compound for laboratory use only.", price:6999, compareAtPrice:8999, category:"Blends", tags:["research","peptide","gh","blend"], imageUrl:"/images/cjc-ipamorelin.png", inStock:true, stockQuantity:70, sku:"CJC-IPA-10MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"6", name:"BPC-157 + TB-500", slug:"bpc-tb500", subtitle:"Recovery Blend", description:"BPC-157 and TB-500 are two of the most widely researched peptides for tissue repair studies. Research compound for laboratory use only.", price:7999, compareAtPrice:9999, category:"Blends", tags:["research","peptide","blend","recovery"], imageUrl:"/images/bpc-tb500.png", inStock:true, stockQuantity:65, sku:"BPC-TB-20MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"7", name:"Glow Blend", slug:"glow-blend", subtitle:"Skin Research Formula", description:"A proprietary research blend formulated for skin biology studies. Contains a curated combination of peptides. For laboratory research use only.", price:8999, compareAtPrice:10999, category:"Blends", tags:["research","peptide","blend","skin"], imageUrl:"/images/glow.png", inStock:true, stockQuantity:50, sku:"GLOW-70MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"8", name:"Retatrutide", slug:"retatrutide", subtitle:"Triple Receptor Agonist", description:"Retatrutide is a triple GIP, GLP-1, and glucagon receptor agonist currently under research investigation. Research compound for laboratory use only.", price:9999, compareAtPrice:12999, category:"Peptides", tags:["research","peptide"], imageUrl:"/images/retatrutide.png", inStock:true, stockQuantity:30, sku:"RETA-10MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"9", name:"Tesamorelin", slug:"tesamorelin", subtitle:"GHRH Analog", description:"Tesamorelin is a synthetic analogue of growth hormone-releasing hormone (GHRH). Research compound for laboratory use only.", price:6499, compareAtPrice:8499, category:"Peptides", tags:["research","peptide","gh"], imageUrl:"/images/tesamorelin.png", inStock:true, stockQuantity:45, sku:"TESA-10MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"10", name:"Ipamorelin", slug:"ipamorelin", subtitle:"Growth Hormone Secretagogue", description:"Ipamorelin is a peptide selective agonist of the ghrelin/growth hormone secretagogue receptor. Research compound for laboratory use only.", price:4499, compareAtPrice:5999, category:"Peptides", tags:["research","peptide","gh"], imageUrl:"/images/cjc-ipamorelin.png", inStock:true, stockQuantity:90, sku:"IPA-5MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"11", name:"CJC-1295", slug:"cjc-1295", subtitle:"GHRH Analog", description:"CJC-1295 is a synthetic analogue of growth hormone-releasing hormone. Research compound for laboratory use only.", price:4999, compareAtPrice:6499, category:"Peptides", tags:["research","peptide","gh"], imageUrl:"/images/cjc-ipamorelin.png", inStock:true, stockQuantity:70, sku:"CJC-2MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter((p) => p.featured && p.published);
}

export function getAllProducts(): Product[] {
  return PRODUCTS.filter((p) => p.published);
}
